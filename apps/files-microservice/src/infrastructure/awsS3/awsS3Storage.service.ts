import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from '../../domain/services/awsS3Storage/storage.service';
import { AppConfig } from '../../config/app.config';
import {
  GeneratePresignedGetUrlInput,
  GeneratePresignedPutUrlInput,
  GetObjectMetadataInput,
} from '../../domain/services/awsS3Storage/input.models';
import {
  GeneratePresignedGetUrlResult,
  GeneratePresignedPutUrlResult,
  ObjectMetadataResult,
} from '../../domain/services/awsS3Storage/output.models';

@Injectable()
export class AwsS3StorageService implements StorageService {
  private readonly logger = new Logger(AwsS3StorageService.name);
  private readonly bucketName: string;
  private readonly s3Client: S3Client;
  private readonly region: string;
  constructor(private readonly appConfig: AppConfig) {
    this.bucketName = this.appConfig.s3Bucket;
    this.region = this.appConfig.s3Region;
    this.s3Client = new S3Client({
      region: this.appConfig.s3Region,
      credentials: appConfig.s3AccessKeyId
        ? {
            accessKeyId: appConfig.s3AccessKeyId,
            secretAccessKey: appConfig.s3SecretAccessKeyId,
          }
        : undefined, // Use IAM roles in production (no credentials needed)
      /*checksumAlgorithms: 'CRC32', // Enable checksums for integrity*/
    });
  }

  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Generate presigned PUT URL for client-side upload
   * Best for: Large files (1-20MB), client uploads directly to S3
   */
  async generatePresignedPutUrl(
    input: GeneratePresignedPutUrlInput,
  ): Promise<GeneratePresignedPutUrlResult> {
    const { key, mimeType, expiresInSeconds, size } = input;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
      // Best practices
      Metadata: {
        'original-size': size?.toString() ?? '',
        'uploaded-at': new Date().toISOString(),
      },
      // Encryption (SSE-S3 is default, AWS manages keys)
      // For extra security, use SSE-KMS:
      // ServerSideEncryption: 'aws:kms',
      // SSEKMSKeyId: 'your-kms-key-id',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    // Validate URL is valid
    try {
      new URL(uploadUrl);
    } catch (error) {
      this.logger.error('Invalid presigned URL generated', error);
      throw new Error('Failed to generate presigned URL');
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      uploadUrl,
      expiresAt,
    };
  }

  /**
   * Get object metadata without downloading file
   * Best for: Check if file exists, get file size, MIME type
   */
  async getObjectMetadata(
    input: GetObjectMetadataInput,
  ): Promise<ObjectMetadataResult | null> {
    try {
      // Use HeadObjectCommand (faster than GetObject, doesn't download body)
      const command = new HeadObjectCommand({
        Bucket: this.bucketName, // Always use service bucket for S3
        Key: input.key,
      });

      const response = await this.s3Client.send(command);

      return {
        key: input.key,
        size: response.ContentLength ?? 0,
        mimeType: response.ContentType ?? '',
        lastModified: response.LastModified ?? new Date(),
        eTag: response.ETag ?? '',
        checksum: response.ChecksumCRC32 ?? '',
      };
    } catch (error) {
      // File not found
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        return null;
      }
      this.logger.error('Failed to get object metadata', error);
      throw error;
    }
  }

  async generatePresignedGetUrl(
    input: GeneratePresignedGetUrlInput,
  ): Promise<GeneratePresignedGetUrlResult> {
    const { storageKey, expiresInSeconds } = input;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      try {
        new URL(url);
      } catch (error) {
        this.logger.error('Invalid presigned GET URL generated', error);
        throw new InternalServerErrorException(
          'Failed to generate presigned GET URL',
        );
      }

      return {
        url,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned GET URL for key=${storageKey}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to generate file URL');
    }
  }

  /*/!**
   * Upload file directly from server (not client)
   * Best for: Small files (< 5MB), server-side processing
   *!/
  async uploadObject(
    key: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);
  }

  /!**
   * Download file from S3
   * Best for: Small files (< 5MB), server-side processing
   *!/
  async downloadObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body ?? []) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /!**
   * Delete file from S3
   * Best for: Delete files (user deletes, file expires, etc.)
   *!/
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /!**
   * List files in a prefix (folder)
   * Best for: Get user's files, list files by purpose
   *!/
  async listObjects(
    prefix: string,
    maxResults: number = 100,
  ): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxResults,
    });

    const response = await this.s3Client.send(command);

    return response.Contents?.map((obj) => obj.Key ?? '') ?? [];
  }

  /!**
   * Multipart upload for large files (> 20MB)
   * Best for: Files > 20MB (you have 20MB max, so skip this for now)
   *!/
  async multipartUpload(
    key: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    // Implementation for large files
  }*/
}
