import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { SoftDeleteResponse } from '@app/contracts';

export class SoftDeleteFilesCommand {
  constructor(
    public readonly ownerId: string,
    public readonly fileIds: string[],
  ) {}
}

@Injectable()
@CommandHandler(SoftDeleteFilesCommand)
export class SoftDeleteFilesUseCase implements ICommandHandler<
  SoftDeleteFilesCommand,
  SoftDeleteResponse
> {
  constructor(private readonly filesRepository: FilesRepository) {}

  async execute(command: SoftDeleteFilesCommand): Promise<SoftDeleteResponse> {
    const uniqueFileIds = [...new Set(command.fileIds)].filter(Boolean);

    if (!uniqueFileIds.length) {
      return { count: 0 };
    }

    const count = await this.filesRepository.softDeleteMany({
      ownerId: command.ownerId,
      fileIds: uniqueFileIds,
      deletedAt: new Date(),
    });

    return { count: count };
  }
}
