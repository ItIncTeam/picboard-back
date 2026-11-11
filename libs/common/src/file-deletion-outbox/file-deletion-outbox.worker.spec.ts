import { HttpException, HttpStatus } from '@nestjs/common';
import {
  CLEANUP_EVERY_TICKS,
  FileDeletionOutboxWorker,
  LEASE_MS,
} from './file-deletion-outbox.worker';
import {
  FileDeletionOutboxRepository,
  OutboxTask,
  ClaimedOutboxTask,
} from './file-deletion-outbox.repository';
import { FileDeletionSender } from './file-deletion-sender';

describe('FileDeletionOutboxWorker', () => {
  let worker: FileDeletionOutboxWorker;
  let outbox: jest.Mocked<FileDeletionOutboxRepository>;
  let filesClient: jest.Mocked<FileDeletionSender>;

  const task = (overrides: Partial<OutboxTask> = {}): OutboxTask => ({
    id: 'task-1',
    ownerId: 'user-1',
    fileIds: ['file-1'],
    attempts: 0,
    ...overrides,
  });

  const LEASE_UNTIL = new Date('2026-01-01T00:00:00.000Z');

  const claimed = (overrides: Partial<OutboxTask> = {}): ClaimedOutboxTask => ({
    ...task(overrides),
    leaseUntil: LEASE_UNTIL,
  });

  beforeEach(() => {
    outbox = {
      findPendingBatch: jest.fn(),
      claim: jest.fn(),
      markDone: jest.fn().mockResolvedValue(true),
      reschedule: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn().mockResolvedValue(true),
      deleteDoneOlderThan: jest.fn().mockResolvedValue(0),
    };

    filesClient = { markFilesDeleted: jest.fn() };

    worker = new FileDeletionOutboxWorker(outbox, filesClient);
  });

  describe('successful delivery', () => {
    it('should claim the task and markDone on success', async () => {
      outbox.findPendingBatch.mockResolvedValue([task()]);
      outbox.claim.mockResolvedValue(claimed());

      await worker.tick();

      expect(outbox.claim).toHaveBeenCalledWith(
        'task-1',
        expect.any(Date),
        LEASE_MS,
      );
      expect(filesClient.markFilesDeleted).toHaveBeenCalledWith({
        ownerId: 'user-1',
        fileIds: ['file-1'],
      });
      expect(outbox.markDone).toHaveBeenCalledWith('task-1', LEASE_UNTIL);
    });
  });

  describe('error delivery at attempts=0', () => {
    it('should reschedule (not markFailed)', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      filesClient.markFilesDeleted.mockRejectedValue(new Error('TCP error'));

      await worker.tick();

      expect(outbox.reschedule).toHaveBeenCalledWith(
        'task-1',
        'TCP error',
        expect.any(Date),
        LEASE_UNTIL,
      );
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('permanent 4xx failure', () => {
    it('marks FAILED immediately without rescheduling', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      filesClient.markFilesDeleted.mockRejectedValue({
        statusCode: 400,
        message: 'invalid file ids',
      });

      await worker.tick();

      expect(outbox.markFailed).toHaveBeenCalledWith(
        'task-1',
        'invalid file ids',
        LEASE_UNTIL,
      );
      expect(outbox.reschedule).not.toHaveBeenCalled();
    });

    it('still retries 5xx', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      filesClient.markFilesDeleted.mockRejectedValue({
        statusCode: 503,
        message: 'files down',
      });

      await worker.tick();

      expect(outbox.reschedule).toHaveBeenCalledWith(
        'task-1',
        'files down',
        expect.any(Date),
        LEASE_UNTIL,
      );
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });

    it('marks FAILED on an HttpException 4xx', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      filesClient.markFilesDeleted.mockRejectedValue(
        new HttpException('invalid file ids', HttpStatus.BAD_REQUEST),
      );

      await worker.tick();

      expect(outbox.markFailed).toHaveBeenCalledWith(
        'task-1',
        'invalid file ids',
        LEASE_UNTIL,
      );
      expect(outbox.reschedule).not.toHaveBeenCalled();
    });

    it('still retries an HttpException 5xx', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      filesClient.markFilesDeleted.mockRejectedValue(
        new HttpException('files down', HttpStatus.SERVICE_UNAVAILABLE),
      );

      await worker.tick();

      expect(outbox.reschedule).toHaveBeenCalledWith(
        'task-1',
        'files down',
        expect.any(Date),
        LEASE_UNTIL,
      );
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('attempts=4 (next=5=MAX)', () => {
    it('should markFailed', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 4 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 4 }));
      filesClient.markFilesDeleted.mockRejectedValue(new Error('TCP error'));

      await worker.tick();

      expect(outbox.markFailed).toHaveBeenCalledWith(
        'task-1',
        'TCP error',
        LEASE_UNTIL,
      );
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

      await expect(worker.tick()).resolves.toBeUndefined();
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

  describe('atomic claim and state transitions', () => {
    it('claim вернул null → markFilesDeleted не вызывается', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(null);

      await worker.tick();

      expect(filesClient.markFilesDeleted).not.toHaveBeenCalled();
    });

    it('markDone вернул false → reschedule и markFailed не вызываются, tick не бросает', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      outbox.markDone.mockResolvedValue(false);

      await worker.tick();

      expect(outbox.reschedule).not.toHaveBeenCalled();
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });

    it('markDone бросил Error → reschedule и markFailed не вызываются, tick не бросает', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim.mockResolvedValue(claimed({ attempts: 0 }));
      outbox.markDone.mockRejectedValue(new Error('db error'));

      await expect(worker.tick()).resolves.toBeUndefined();

      expect(outbox.reschedule).not.toHaveBeenCalled();
      expect(outbox.markFailed).not.toHaveBeenCalled();
    });

    it('два последовательных tick с одним findPendingBatch-результатом и claim, который первый раз возвращает задачу, второй раз null → markFilesDeleted вызван один раз', async () => {
      outbox.findPendingBatch.mockResolvedValue([task({ attempts: 0 })]);
      outbox.claim
        .mockResolvedValueOnce(claimed({ attempts: 0 }))
        .mockResolvedValueOnce(null);

      await worker.tick();
      await worker.tick();

      expect(filesClient.markFilesDeleted).toHaveBeenCalledTimes(1);
    });
  });
});
