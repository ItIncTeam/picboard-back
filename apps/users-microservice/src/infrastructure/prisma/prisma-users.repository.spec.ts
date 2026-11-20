import { PrismaUsersRepository } from './prisma-users.repository';
import { UsersPrismaService } from './users-prisma.service';

const USER_ID = '7d3f0c2a-9b1e-4c5d-8a6f-1e2d3c4b5a69';
const FILE_ID = '2b8e4f6a-1c3d-4e5f-9a7b-8c9d0e1f2a3b';

describe('PrismaUsersRepository', () => {
  describe('clearProfilePictureAndEnqueueFileDeletion', () => {
    let repository: PrismaUsersRepository;
    let tx: {
      $queryRaw: jest.Mock;
      user: { update: jest.Mock };
      fileDeletionOutbox: { create: jest.Mock };
    };

    beforeEach(() => {
      tx = {
        $queryRaw: jest.fn(),
        user: { update: jest.fn() },
        fileDeletionOutbox: { create: jest.fn() },
      };

      // the client has only $transaction, so a query made outside the
      // transaction would throw and fail the test
      const prisma = {
        $transaction: jest.fn(
          (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        ),
      };

      repository = new PrismaUsersRepository(
        prisma as unknown as UsersPrismaService,
      );
    });

    it('should lock the row, clear the avatar and queue its file', async () => {
      tx.$queryRaw.mockResolvedValue([{ profilePictureFileId: FILE_ID }]);

      await repository.clearProfilePictureAndEnqueueFileDeletion(USER_ID);

      const [sql, ...params] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const query = sql.join('$1');
      expect(query).toContain('$1::uuid');
      expect(query).toContain('FOR UPDATE');
      expect(params).toEqual([USER_ID]);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { profilePictureFileId: null },
      });
      expect(tx.fileDeletionOutbox.create).toHaveBeenCalledWith({
        data: { ownerId: USER_ID, fileIds: [FILE_ID] },
      });
    });

    it.each([
      ['the user has no avatar', [{ profilePictureFileId: null }]],
      ['the user row does not exist', []],
    ])('should do nothing when %s', async (_case, rows) => {
      tx.$queryRaw.mockResolvedValue(rows);

      await expect(
        repository.clearProfilePictureAndEnqueueFileDeletion(USER_ID),
      ).resolves.toBeUndefined();

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.fileDeletionOutbox.create).not.toHaveBeenCalled();
    });
  });
});
