import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { FileStatus } from '../../../domain/enums/file-status.enum';
import { CheckOwnedReadyFilesResponse } from '@app/contracts';

export class CheckOwnedReadyFilesQuery {
  constructor(
    public readonly ownerId: string,
    public readonly fileIds: string[],
  ) {}
}

@QueryHandler(CheckOwnedReadyFilesQuery)
@Injectable()
export class CheckOwnedReadyFilesHandler implements IQueryHandler<
  CheckOwnedReadyFilesQuery,
  CheckOwnedReadyFilesResponse
> {
  private readonly logger = new Logger(CheckOwnedReadyFilesHandler.name);

  constructor(private readonly filesRepository: FilesRepository) {}

  async execute(
    query: CheckOwnedReadyFilesQuery,
  ): Promise<CheckOwnedReadyFilesResponse> {
    const { ownerId, fileIds } = query;

    const uniqueFileIds = [...new Set(fileIds)];

    if (uniqueFileIds.length !== fileIds.length) {
      this.logger.warn(
        `Duplicate file ids received for ownerId=${ownerId}. requested=${fileIds.length}, unique=${uniqueFileIds.length}`,
      );
    }

    this.logger.debug(
      `Checking READY ownership for ownerId=${ownerId}, fileIdsCount=${uniqueFileIds.length}`,
    );

    const files = await this.filesRepository.findByIdsOwnerAndStatus(
      uniqueFileIds,
      ownerId,
      FileStatus.READY,
    );

    const validFileIds = files.map((file) => file.id);
    const validSet = new Set(validFileIds);
    const invalidFileIds = uniqueFileIds.filter((id) => !validSet.has(id));

    if (invalidFileIds.length > 0) {
      this.logger.warn(
        `Invalid files detected for ownerId=${ownerId}. valid=${validFileIds.length}, invalid=${invalidFileIds.length}, invalidFileIds=${invalidFileIds.join(',')}`,
      );
    } else {
      this.logger.debug(
        `All files are valid for ownerId=${ownerId}. valid=${validFileIds.length}`,
      );
    }

    return {
      validFileIds,
      invalidFileIds,
    };
  }
}
