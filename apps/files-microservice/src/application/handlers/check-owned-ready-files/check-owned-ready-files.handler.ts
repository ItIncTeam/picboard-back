import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  GatewayTimeoutException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { FileStatus } from '../../../domain/enums/file-status.enum';
import { CheckOwnedReadyFilesResponse } from '@app/contracts';
import { Prisma } from '../../../../../../prisma/apps/files/src/generated/prisma/files-client';

const CHECK_OWNED_READY_FILES_TIMEOUT_MS = 3000;

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
    const startedAt = Date.now();
    const { ownerId, fileIds } = query;
    const uniqueFileIds = [...new Set(fileIds)];

    if (uniqueFileIds.length !== fileIds.length) {
      this.logger.warn(
        JSON.stringify({
          event: 'duplicate_file_ids_received',
          ownerId,
          requestedCount: fileIds.length,
          uniqueCount: uniqueFileIds.length,
        }),
      );
    }

    this.logger.debug(
      JSON.stringify({
        event: 'check_owned_ready_files_started',
        ownerId,
        fileIdsCount: uniqueFileIds.length,
      }),
    );

    try {
      const files = await this.withTimeout(
        this.filesRepository.findByIdsOwnerAndStatus(
          uniqueFileIds,
          ownerId,
          FileStatus.READY,
        ),
        CHECK_OWNED_READY_FILES_TIMEOUT_MS,
      );

      if (!Array.isArray(files)) {
        throw new InternalServerErrorException(
          'Files repository returned invalid result',
        );
      }

      const validFileIds = files
        .map((file) => file?.id)
        .filter((id): id is string => typeof id === 'string');
      const validSet = new Set(validFileIds);
      const invalidFileIds = uniqueFileIds.filter((id) => !validSet.has(id));

      const durationMs = Date.now() - startedAt;

      this.logger.log(
        JSON.stringify({
          event: 'check_owned_ready_files_completed',
          ownerId,
          requestedCount: fileIds.length,
          uniqueCount: uniqueFileIds.length,
          validCount: validFileIds.length,
          invalidCount: invalidFileIds.length,
          durationMs,
        }),
      );

      if (invalidFileIds.length > 0) {
        this.logger.warn(
          JSON.stringify({
            event: 'invalid_files_detected',
            ownerId,
            validCount: validFileIds.length,
            invalidCount: invalidFileIds.length,
            invalidFileIds,
          }),
        );
      }

      return {
        validFileIds,
        invalidFileIds,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      this.logger.error(
        JSON.stringify({
          event: 'check_owned_ready_files_failed',
          ownerId,
          requestedCount: fileIds.length,
          uniqueCount: uniqueFileIds.length,
          durationMs,
          errorType: this.getErrorType(error),
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        }),
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof GatewayTimeoutException) {
        throw error;
      }

      if (this.isPrismaError(error)) {
        throw error;
      }

      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isTransientInfrastructureError(error)) {
        throw new ServiceUnavailableException(
          'Files lookup is temporarily unavailable',
        );
      }

      throw new InternalServerErrorException(
        'Failed to check owned ready files',
      );
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new GatewayTimeoutException('Files repository request timed out'),
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private isPrismaError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientValidationError
    );
  }

  private isTransientInfrastructureError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('connection pool') ||
      message.includes('fetching a new connection') ||
      message.includes('too many connections') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('connection terminated') ||
      message.includes('temporarily unavailable')
    );
  }

  private getErrorType(error: unknown): string {
    if (error instanceof GatewayTimeoutException) {
      return 'gateway-timeout';
    }

    if (this.isPrismaError(error)) {
      return 'prisma';
    }

    if (error instanceof HttpException) {
      return 'http';
    }

    if (this.isTransientInfrastructureError(error)) {
      return 'transient-infrastructure';
    }

    if (error instanceof Error) {
      return 'runtime';
    }

    return 'unknown';
  }
}
