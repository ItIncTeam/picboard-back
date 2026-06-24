import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';
import { StorageKeyBuilder } from '../../../infrastructure/storage-key/storage-key-builder.service';
import { FileStatus } from '../../../domain/enums/file-status.enum';
import { InitiateUploadInput } from '../../../graphql/inputs/initiate-upload.input';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AppConfig } from '../../../config/app.config';

export class InitiateUploadBatchResult {
  clientUploadId: string;
  fileId: string;
  uploadUrl: string;
  expiresAt: Date;
}

export class InitiateUploadBatchCommand {
  constructor(
    public readonly items: InitiateUploadInput[],
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(InitiateUploadBatchCommand)
@Injectable()
export class InitiateUploadBatchUseCase implements ICommandHandler<
  InitiateUploadBatchCommand,
  InitiateUploadBatchResult[]
> {
  private readonly logger = new Logger(InitiateUploadBatchUseCase.name);
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly storageKeyBuilder: StorageKeyBuilder,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(
    command: InitiateUploadBatchCommand,
  ): Promise<InitiateUploadBatchResult[]> {
    const { items, ownerId } = command;

    if (!items.length) {
      throw new BadRequestException('At least one file is required');
    }

    if (items.length > 10) {
      throw new BadRequestException('Maximum 10 files are allowed');
    }

    /*this.fileUploadPolicyService.validateBatch(items);
    items.forEach((item) => this.fileUploadPolicyService.validateItem(item));*/

    const bucket = this.storageService.getBucketName();

    const preparedItems = items.map((item) => {
      const fileId = randomUUID();
      const storageKey = this.storageKeyBuilder.build({
        fileId,
        ownerId,
        originalName: item.originalName,
        purpose: item.purpose,
      });

      return {
        fileId,
        clientUploadId: item.clientUploadId,
        originalName: item.originalName,
        purpose: item.purpose,
        mimeType: item.mimeType,
        size: item.size,
        storageKey,
        bucket,
      };
    });

    await this.filesRepository.createManyPending(
      preparedItems.map((item) => ({
        id: item.fileId,
        ownerId,
        originalName: item.originalName,
        purpose: item.purpose,
        mimeType: item.mimeType,
        size: item.size,
        storageKey: item.storageKey,
        bucket: item.bucket,
        status: FileStatus.PENDING,
      })),
    );

    try {
      const signedItems = await Promise.all(
        preparedItems.map(async (item) => {
          const signed = await this.storageService.generatePresignedPutUrl({
            key: item.storageKey,
            mimeType: item.mimeType,
            expiresInSeconds: this.appConfig.s3UrlExpiresInSeconds,
            size: item.size,
          });

          return {
            clientUploadId: item.clientUploadId,
            fileId: item.fileId,
            uploadUrl: signed.uploadUrl,
            storageKey: item.storageKey,
            expiresAt: signed.expiresAt,
          };
        }),
      );

      return signedItems;
    } catch (error) {
      // If S3 fails, files are already in DB as PENDING
      // You could mark them as FAILED or delete them
      this.logger.error('Failed to generate presigned URLs', error);
      throw new InternalServerErrorException('Failed to generate upload URLs');
    }
  }
}
