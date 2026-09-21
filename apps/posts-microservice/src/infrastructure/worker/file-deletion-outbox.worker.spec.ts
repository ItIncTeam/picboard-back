import { FileDeletionOutboxWorker } from './file-deletion-outbox.worker';
import { FileDeletionOutboxRepository } from '../../domain/repositories/file-deletion-outbox.repository';
import { FilesServiceClient } from '../client/files-service.client';
import { CLEANUP_EVERY_TICKS, MAX_ATTEMPTS } from './file-deletion-outbox.worker';

describe('FileDeletionOutboxWorker', () => {
  let worker: FileDeletionOutboxWorker;
  let outbox: jest.Mocked<FileDeletionOutboxRepository>;
  let filesClient: jest.Mocked<FilesServiceClient>;

  const now = new Date('2026-01-01');

  const task = (overrides: Partial<{ id: string; ownerId: string; fileIds: string[]; attempts: number }> = {}) => ({
    id: 'task-1',
    ownerId: 'user-1',
    fileIds: ['file-1'],
    attempts: 0,
    ...overrides,
  });

  beforeEach(() => {
    outbox = {
      findPendingBatch: jest.fn(),
      markDone: jest.fn(),
      reschedule: jest.fn(),
      markFailed: jest.fn(),
      deleteDoneOlderThan: jest.fn(),
    } as unknown as jest.Mocked<FileDeletionOutboxRepository>;

    filesClient = {
      markFilesDeleted: jest.fn(),
    } as unknown as jest.Mocked<FilesServiceClient>;

    worker = new FileDeletionOutboxWorker(outbox, filesClient);
  });

  describe('successful delivery', () => {
    it('should mark markDone on success', async () => {
      outbox.findPendingBatch.mockResolvedValue([task()]);

      await worker.tick();

      expect(outbox.markDone).toHaveBeenCalledWith('task-1');
      expect(filesClient.markFilesDeleted).toHaveBeenCalledWith({
        ownerId: 'user-1',
        fileIds: ['file-1'],
      });
    });
  });

  describe('error delivery at attempts=0', () => {
    it('should reschedule (not markFailed)', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      filesClient.markFilesDeleted.mockRejectedValue(new Error('TCP error'));

      await worker.tick();

      expect(outbox.reschedule).toHaveBeenCalledWith(
        'task-1',
        'TCP error',
        expect.any(Date),
      );
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('attempts=4 (next=5=MAX)', () => {
    it('should markFailed', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 4 })]);
      filesClient.markFilesDeleted.mockRejectedValue(new Error('TCP error'));

      await worker.tick();

      expect(outbox.markFailed).toHaveBeenCalledWith('task-1', 'TCP error');
      expect(outbox.reschedule).not.toHaveBeenCalled();
    });
  });

  describe('empty batch', () => {
    it('should not call markFilesDeleted', async () => {
      outbox.findPendingBatch.mockResolvedValue([]);

      await worker.tick();

      expect(filesClient.markFilesDeleted).not.toHaveBeenCalled();
    });
  });

  describe('error in findPendingBatch', () => {
    it('should not throw', async () => {
      outbox.findPendingBatch.mockRejectedValue(new Error('DB error'));

      await expect(worker.tick()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('triggers cleanup after CLEANUP_EVERY_TICKS ticks', async () => {
      outbox.findPendingBatch.mockResolvedValue([]);

      for (let i = 0; i < CLEANUP_EVERY_TICKS; i++) {
        await worker.tick();
      }

      expect(outbox.deleteDoneOlderThan).toHaveBeenCalledTimes(1);
    });

    it('does not cleanup before threshold', async () => {
      outbox.findPendingBatch.mockResolvedValue([]);

      for (let i = 0; i < CLEANUP_EVERY_TICKS - 1; i++) {
        await worker.tick();
      }

      expect(outbox.deleteDoneOlderThan).not.toHaveBeenCalled();
    });

    it('does not throw when cleanup fails', async () => {
      outbox.findPendingBatch.mockResolvedValue([]);
      outbox.deleteDoneOlderThan.mockRejectedValue(new Error('db'));

      // cleanup срабатывает на 240-м тике — гоняем до порога,
      // проверяя, что падение cleanup не пробрасывается наружу
      for (let i = 0; i < CLEANUP_EVERY_TICKS; i++) {
        await expect(worker.tick()).resolves.toBeUndefined();
      }

      expect(outbox.deleteDoneOlderThan).toHaveBeenCalledTimes(1);
    });
  });
});