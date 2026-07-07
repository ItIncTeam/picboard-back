import { FileStatus } from '../../../domain/enums/file-status.enum';
import { Mime } from '../../../domain/enums/file-mime';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';

export class CompleteUploadBatchCommand {
  constructor(
    public readonly fileIds: string[],
    public readonly ownerId: string,
  ) {}
}

export class CompleteUploadBatchResult {
  fileId: string;
  status: FileStatus;
}

// verify ownership, confirm object existence or metadata, transition status to UPLOADED/READY, persist storage metadata
@CommandHandler(CompleteUploadBatchCommand)
@Injectable()
export class CompleteUploadBatchUseCase implements ICommandHandler<
  CompleteUploadBatchCommand,
  CompleteUploadBatchResult[]
> {
  private readonly logger = new Logger(CompleteUploadBatchUseCase.name);
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(
    command: CompleteUploadBatchCommand,
  ): Promise<CompleteUploadBatchResult[]> {
    const { fileIds, ownerId } = command;

    // Validate batch is not empty
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException('At least one fileId is required');
    }

    // Validate fileIds array is not too large
    if (fileIds.length > 10) {
      throw new BadRequestException('Maximum 10 files are allowed');
    }

    // Step 1: Fetch all file records from DB
    const files = await this.filesRepository.findByIdsOwnerAndStatus(
      fileIds,
      ownerId,
      FileStatus.PENDING,
    );

    // Validate that all requested files exist and belong to the user
    if (files.length !== fileIds.length) {
      const foundIds = files.map((f) => f.id);
      const missingIds = fileIds.filter((id) => !foundIds.includes(id));

      throw new NotFoundException(
        `Files not found or not in PENDING status: ${missingIds.join(', ')}`,
      );
    }
    // Step 2: Verify uploads in S3 and validate
    const results: CompleteUploadBatchResult[] = [];

    for (const file of files) {
      try {
        // Verify object exists in S3
        const objectMetadata = await this.storageService.getObjectMetadata({
          bucket: file.bucket,
          key: file.storageKey,
        });
        /*console.log(objectMetadata);
        {
          key: 'post_image/790bcb34-1180-4498-aa91-47761b71e0c3/2026/06/a6129cd7-306c-47e7-b147-0c70fec91872',
            size: 78350,
          mimeType: 'image/png',
          lastModified: 2026-06-30T12:38:24.000Z,
          eTag: '"74f092f2730dbba49580c33ddeeeaae2"',
          checksum: ''
        }*/

        if (!objectMetadata) {
          this.logger.warn(`File ${file.id} not found in S3`);
          await this.filesRepository.updateStatus(
            file.id,
            FileStatus.FAILED,
            'Object not found in storage',
          );
          results.push({ fileId: file.id, status: FileStatus.FAILED });
          continue;
        }

        // Check ContentLength matches declared size
        if (objectMetadata.size !== file.size) {
          this.logger.warn(
            `File ${file.id} size mismatch: ${file.size} vs ${objectMetadata.size}`,
          );
          await this.filesRepository.updateStatus(
            file.id,
            FileStatus.FAILED,
            `Size mismatch: declared ${file.size}, actual ${objectMetadata.size}`,
          );
          results.push({ fileId: file.id, status: FileStatus.FAILED });
          continue;
        }

        // Check ContentType matches declared mimeType
        function toMimeEnum(value: string | null | undefined): Mime | null {
          if (!value) return null;

          switch (value.toLowerCase()) {
            case 'image/png':
            case 'png':
              return Mime.PNG;

            case 'image/jpeg':
            case 'image/jpg':
            case 'jpeg':
            case 'jpg':
              return Mime.JPEG;

            default:
              return null;
          }
        }
        if (
          objectMetadata.mimeType &&
          toMimeEnum(objectMetadata.mimeType) !== file.mimeType
        ) {
          this.logger.warn(
            `File ${file.id} MIME mismatch: ${file.mimeType} vs ${objectMetadata.mimeType}`,
          );
          await this.filesRepository.updateStatus(
            file.id,
            FileStatus.FAILED,
            `MIME mismatch: declared ${file.mimeType}, actual ${objectMetadata.mimeType}`,
          );
          results.push({ fileId: file.id, status: FileStatus.FAILED });
          continue;
        }

        // Step 3: Transition UPLOADED -> READY
        await this.filesRepository.updateStatus(
          file.id,
          FileStatus.READY,
          undefined,
          new Date(),
        );

        results.push({ fileId: file.id, status: FileStatus.READY });
      } catch (error) {
        const errorMessage = error.message || 'Upload verification failed';
        this.logger.error(`Failed to verify file ${file.id}`, error);

        await this.filesRepository.updateStatus(
          file.id,
          FileStatus.FAILED,
          errorMessage,
        );

        results.push({ fileId: file.id, status: FileStatus.FAILED });
      }
    }

    return results;
  }
}
