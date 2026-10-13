import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';
import { AppConfig } from '../../../config/app.config';
import { UPLOAD_RULES } from '../../../files/files.constants';

export class RetryUploadBatchCommand {
  constructor(
    public readonly fileIds: string[],
    public readonly ownerId: string,
  ) {}
}

export class RetryUploadBatchResult {
  fileId: string;
  uploadUrl: string;
  expiresAt: Date;
  attempt: number;
}

// Re-issues a presigned PUT URL for a file whose upload never completed.
// The file row and its storage key are reused, so the client re-PUTs over
// the same object instead of creating a second one.
@CommandHandler(RetryUploadBatchCommand)
@Injectable()
export class RetryUploadBatchUseCase implements ICommandHandler<
  RetryUploadBatchCommand,
  RetryUploadBatchResult[]
> {
  private readonly logger = new Logger(RetryUploadBatchUseCase.name);

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(
    command: RetryUploadBatchCommand,
  ): Promise<RetryUploadBatchResult[]> {
    const { fileIds, ownerId } = command;
    // batch size and uuid shape are enforced by RetryUploadArgs at the
    // resolver boundary; duplicates are not, so collapse them here
    const uniqueFileIds = [...new Set(fileIds)];

    // findRetryable already filters by ownerId, deletedAt and
    // PENDING/FAILED status, so anything missing here is either not the
    // caller's, already READY, or gone.
    const files = await this.filesRepository.findRetryable(
      uniqueFileIds,
      ownerId,
    );

    if (files.length !== uniqueFileIds.length) {
      const foundIds = new Set(files.map((file) => file.id));
      const missingIds = uniqueFileIds.filter((id) => !foundIds.has(id));

      throw new NotFoundException(
        `Files not found, not owned, or not retryable: ${missingIds.join(', ')}`,
      );
    }

    const exhausted = files.filter(
      (file) => file.uploadAttempts >= UPLOAD_RULES.MAX_UPLOAD_ATTEMPTS,
    );

    if (exhausted.length > 0) {
      throw new BadRequestException(
        `Retry limit of ${UPLOAD_RULES.MAX_UPLOAD_ATTEMPTS} reached: ` +
          `${exhausted.map((file) => file.id).join(', ')}`,
      );
    }

    // Both guards above run before anything is written, so a rejected batch
    // never leaves some attempt counters already incremented.
    // Presigning itself is local crypto with no side effects, which is why
    // the whole batch can be signed before any row is touched.
    const signedItems = await Promise.all(
      files.map(async (file) => ({
        file,
        signed: await this.storageService.generatePresignedPutUrl({
          // Sign the key already stored on the row. Never rebuild it with
          // StorageKeyBuilder: build() embeds the current year/month, so a
          // retry crossing a month boundary would sign a different key and
          // orphan the original object (storageKey is @unique).
          key: file.storageKey,
          // Must be the same value initiate-upload-batch signed, or the
          // Content-Type the client already sends stops matching the
          // signature and S3 answers 403.
          mimeType: file.mimeType,
          size: file.size,
          expiresInSeconds: this.appConfig.s3UrlExpiresInSeconds,
        }),
      })),
    );

    return Promise.all(
      signedItems.map(async ({ file, signed }) => {
        const updated = await this.filesRepository.markRetrying(file.id);

        this.logger.log(
          JSON.stringify({
            event: 'upload_retry_issued',
            fileId: file.id,
            ownerId,
            attempt: updated.uploadAttempts,
          }),
        );

        return {
          fileId: file.id,
          uploadUrl: signed.uploadUrl,
          expiresAt: signed.expiresAt,
          attempt: updated.uploadAttempts,
        };
      }),
    );
  }
}
