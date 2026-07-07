import { CreatePendingFileData } from './create-pending-file-data.type';
import { FileEntity } from '../../entities/file.entity';
import { FileStatus } from '../../enums/file-status.enum';

export abstract class FilesRepository {
  abstract createManyPending(
    items: CreatePendingFileData[],
  ): Promise<FileEntity[]>;
  abstract findByIdsOwnerAndStatus(
    ids: string[],
    ownerId: string,
    status: FileStatus,
  ): Promise<FileEntity[]>;
  abstract updateStatus(
    id: string,
    status: FileStatus,
    failedReason?: string | null,
    timestamp?: Date | null,
  ): Promise<FileEntity>;
  abstract findById(id: string): Promise<FileEntity>;
  abstract findByIds(ids: string[]): Promise<FileEntity[]>;
  abstract softDeleteMany(input: {
    ownerId: string;
    fileIds: string[];
    deletedAt: Date;
  }): Promise<number>;
}
