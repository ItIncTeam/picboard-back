import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';
import { FileStatus } from '../../../domain/enums/file-status.enum';
import { AppConfig } from '../../../config/app.config';
import { File } from '../../../graphql/types/file.type';

export class ResolveFileUrlCommand {
  constructor(public readonly file: File) {}
}

@CommandHandler(ResolveFileUrlCommand)
@Injectable()
export class ResolveFileUrlUseCase implements ICommandHandler<ResolveFileUrlCommand> {
  private readonly logger = new Logger(ResolveFileUrlUseCase.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(command: ResolveFileUrlCommand): Promise<string> {
    const { file } = command;

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status !== FileStatus.READY) {
      this.logger.warn(
        `File is not READY, URL will not be resolved. fileId=${file.id}, status=${file.status}`,
      );
      throw new UnprocessableEntityException('File is not ready for download');
    }

    if (!file.storageKey) {
      this.logger.error(`File storage key is missing. fileId=${file.id}`);
      throw new NotFoundException('File storage key not found');
    }

    const result = await this.storageService.generatePresignedGetUrl({
      storageKey: file.storageKey,
      expiresInSeconds: this.appConfig.s3UrlExpiresInSeconds,
    });

    return result.url;
  }
}
