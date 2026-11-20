import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { FILES_TCP_PATTERNS } from '@app/contracts';
import { FilesServiceClient } from './files-service.client';

const OWNER_ID = 'user-1';
const FILE_ID = 'file-1';

describe('FilesServiceClient', () => {
  const appConfig = {
    filesTcpHost: 'localhost',
    filesTcpPort: 3033,
  } as never;

  const buildClientWithMockSend = (response: unknown = {}) => {
    const client = new FilesServiceClient(appConfig);
    const send = jest.fn().mockReturnValue(of(response));
    // swap the internal TCP client for a mock
    (client as unknown as { client: { send: typeof send } }).client = { send };
    return { client, send };
  };

  describe('isOwnedReadyAvatar', () => {
    it('asks files-service for an owned, READY file with purpose AVATAR', async () => {
      const { client, send } = buildClientWithMockSend({
        validFileIds: [FILE_ID],
        invalidFileIds: [],
      });

      await client.isOwnedReadyAvatar(FILE_ID, OWNER_ID);

      expect(send).toHaveBeenCalledWith(FILES_TCP_PATTERNS.CHECK_OWNED_READY, {
        ownerId: OWNER_ID,
        fileIds: [FILE_ID],
        purpose: 'AVATAR',
      });
    });

    it('returns true when the file is valid', async () => {
      const { client } = buildClientWithMockSend({
        validFileIds: [FILE_ID],
        invalidFileIds: [],
      });

      await expect(client.isOwnedReadyAvatar(FILE_ID, OWNER_ID)).resolves.toBe(
        true,
      );
    });

    it('returns false when the file is invalid', async () => {
      const { client } = buildClientWithMockSend({
        validFileIds: [],
        invalidFileIds: [FILE_ID],
      });

      await expect(client.isOwnedReadyAvatar(FILE_ID, OWNER_ID)).resolves.toBe(
        false,
      );
    });

    it('maps a connection failure to 503', async () => {
      const { client, send } = buildClientWithMockSend();
      send.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

      await expect(
        client.isOwnedReadyAvatar(FILE_ID, OWNER_ID),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('markFilesDeleted', () => {
    it('sends ownerId and fileIds', async () => {
      const { client, send } = buildClientWithMockSend({ count: 1 });

      await client.markFilesDeleted({ ownerId: OWNER_ID, fileIds: [FILE_ID] });

      expect(send).toHaveBeenCalledWith(FILES_TCP_PATTERNS.MARK_FILES_DELETED, {
        ownerId: OWNER_ID,
        fileIds: [FILE_ID],
      });
    });

    it('rejects with the RPC error as received, so the outbox worker can classify it', async () => {
      const rpcError = { statusCode: 400, message: 'invalid file ids' };
      const { client, send } = buildClientWithMockSend();
      send.mockReturnValue(throwError(() => rpcError));

      await expect(
        client.markFilesDeleted({ ownerId: OWNER_ID, fileIds: [FILE_ID] }),
      ).rejects.toBe(rpcError);
    });
  });
});
