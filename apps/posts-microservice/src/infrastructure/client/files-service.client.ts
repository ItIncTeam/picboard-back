import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ClientProxy, ClientTCP } from '@nestjs/microservices';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import {
  CheckOwnedReadyFilesResponse,
  FILES_TCP_PATTERNS,
  SoftDeleteFilesInput,
} from '@app/contracts';

/** TCP-паттерн для валидации файлов — должен совпадать с files-service */
/*export const FILES_TCP_PATTERNS = {
  CHECK_OWNED_READY: { cmd: 'files.checkOwnedReady' },
} as const;

export interface CheckOwnedReadyResponse {
  validFileIds: string[];
  invalidFileIds: string[];
}*/

@Injectable()
export class FilesServiceClient {
  private client: ClientProxy;
  private readonly logger = new Logger(FilesServiceClient.name);

  constructor(private readonly appConfig: AppConfig) {
    this.client = new ClientTCP({
      port: appConfig.filesTcpPort,
      host: appConfig.filesTcpHost,
    });
  }

  private async validateOwnedFiles(
    fileIds: string[],
    ownerId: string,
  ): Promise<CheckOwnedReadyFilesResponse> {
    try {
      return await firstValueFrom(
        this.client
          .send<CheckOwnedReadyFilesResponse>(
            FILES_TCP_PATTERNS.CHECK_OWNED_READY,
            {
              ownerId,
              fileIds,
            },
          )
          .pipe(timeout(5000)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new BadRequestException('Files service timeout');
      }
      throw new BadRequestException('Files service unavailable');
    }
  }

  async markFilesDeleted(data: SoftDeleteFilesInput): Promise<void> {
    try {
      await firstValueFrom(
        this.client
          .send(FILES_TCP_PATTERNS.MARK_FILES_DELETED, {
            ownerId: data.ownerId,
            filesIds: data.fileIds,
          })
          .pipe(timeout(5000)),
      );
    } catch (error) {
      this.logger.error('Failed to mark files as deleted', error);
    }
  }

  async assertAllOwnedReadyOrException(
    fileIds: string[],
    ownerId: string,
  ): Promise<void> {
    const result = await this.validateOwnedFiles(fileIds, ownerId);

    if (result.invalidFileIds.length > 0) {
      throw new BadRequestException(
        `Invalid file ids: ${result.invalidFileIds.join(', ')}`,
      );
    }
  }
}
