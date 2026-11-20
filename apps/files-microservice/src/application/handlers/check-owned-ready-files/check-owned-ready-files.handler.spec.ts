import { Logger } from '@nestjs/common';
import {
  CheckOwnedReadyFilesHandler,
  CheckOwnedReadyFilesQuery,
} from './check-owned-ready-files.handler';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { FileEntity } from '../../../domain/entities/file.entity';
import { FileStatus } from '../../../domain/enums/file-status.enum';
import { Purpose } from '../../../domain/enums/file-purpose.enum';

const OWNER_ID = 'user-1';
const FILE_ID = 'file-1';
const OTHER_FILE_ID = 'file-2';

describe('CheckOwnedReadyFilesHandler', () => {
  let handler: CheckOwnedReadyFilesHandler;
  let filesRepository: jest.Mocked<FilesRepository>;

  beforeEach(() => {
    // the handler logs every call; keep the test output readable
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    filesRepository = {
      findByIdsOwnerAndStatus: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<FilesRepository>;

    handler = new CheckOwnedReadyFilesHandler(filesRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filters by purpose when one is given', async () => {
    await handler.execute(
      new CheckOwnedReadyFilesQuery(OWNER_ID, [FILE_ID], Purpose.AVATAR),
    );

    expect(filesRepository.findByIdsOwnerAndStatus).toHaveBeenCalledWith(
      [FILE_ID],
      OWNER_ID,
      FileStatus.READY,
      Purpose.AVATAR,
    );
  });

  it('does not filter by purpose when none is given', async () => {
    await handler.execute(new CheckOwnedReadyFilesQuery(OWNER_ID, [FILE_ID]));

    expect(filesRepository.findByIdsOwnerAndStatus).toHaveBeenCalledWith(
      [FILE_ID],
      OWNER_ID,
      FileStatus.READY,
      undefined,
    );
  });

  it('reports files the repository did not return as invalid', async () => {
    // e.g. FILE_ID matched, OTHER_FILE_ID has another purpose
    filesRepository.findByIdsOwnerAndStatus.mockResolvedValue([
      { id: FILE_ID } as FileEntity,
    ]);

    const result = await handler.execute(
      new CheckOwnedReadyFilesQuery(
        OWNER_ID,
        [FILE_ID, OTHER_FILE_ID],
        Purpose.AVATAR,
      ),
    );

    expect(result).toEqual({
      validFileIds: [FILE_ID],
      invalidFileIds: [OTHER_FILE_ID],
    });
  });
});
