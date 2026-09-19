import { of, throwError } from 'rxjs';
import { FilesServiceClient } from './files-service.client';
import { FILES_TCP_PATTERNS } from '@app/contracts';

describe('FilesServiceClient', () => {
  const appConfig = {
    filesTcpPort: 6613,
    filesTcpHost: 'localhost',
  } as never;

  const buildClientWithMockSend = () => {
    const client = new FilesServiceClient(appConfig);
    const send = jest.fn().mockReturnValue(of({ count: 1 }));
    // заменяем внутренний TCP-клиент на мок
    (client as unknown as { client: { send: typeof send } }).client = { send };
    return { client, send };
  };

  describe('markFilesDeleted', () => {
    it('sends payload with the "fileIds" key expected by the contract', async () => {
      const { client, send } = buildClientWithMockSend();

      await client.markFilesDeleted({
        ownerId: 'owner-1',
        fileIds: ['file-1', 'file-2'],
      });

      expect(send).toHaveBeenCalledTimes(1);
      const [pattern, payload] = send.mock.calls[0];
      expect(pattern).toBe(FILES_TCP_PATTERNS.MARK_FILES_DELETED);
      expect(payload).toEqual({
        ownerId: 'owner-1',
        fileIds: ['file-1', 'file-2'],
      });
      // регрессия: ключ не должен называться "filesIds"
      expect(payload).not.toHaveProperty('filesIds');
    });

    it('does not throw when the TCP call fails (fire-and-forget)', async () => {
      const { client, send } = buildClientWithMockSend();
      send.mockReturnValue(throwError(() => new Error('tcp down')));

      await expect(
        client.markFilesDeleted({ ownerId: 'o', fileIds: ['f'] }),
      ).resolves.toBeUndefined();
    });
  });
});
