import { Injectable, BadRequestException } from '@nestjs/common';
import { ClientProxy, ClientTCP } from '@nestjs/microservices';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { AppConfig } from '../../config/app.config';

/** TCP-паттерн для валидации файлов — должен совпадать с files-service */
export const FILES_TCP_PATTERNS = {
  CHECK_OWNED_READY: { cmd: 'files.checkOwnedReady' },
} as const;

export interface CheckOwnedReadyResponse {
  validFileIds: string[];
  invalidFileIds: string[];
}

@Injectable()
export class FilesServiceClient {
  private client: ClientProxy;

  constructor(private readonly appConfig: AppConfig) {
    this.client = new ClientTCP({
      port: appConfig.filesTcpPort,
      host: appConfig.filesTcpHost,
    });
  }

  async validateOwnedFiles(
    fileIds: string[],
    ownerId: string,
  ): Promise<CheckOwnedReadyResponse> {
    try {
      return await firstValueFrom(
        this.client
          .send<CheckOwnedReadyResponse>(FILES_TCP_PATTERNS.CHECK_OWNED_READY, {
            ownerId,
            fileIds,
          })
          .pipe(timeout(5000)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new BadRequestException('Files service timeout');
      }
      throw new BadRequestException('Files service unavailable');
    }
  }

  async assertAllOwnedReady(fileIds: string[], ownerId: string): Promise<void> {
    const result = await this.validateOwnedFiles(fileIds, ownerId);

    if (result.invalidFileIds.length > 0) {
      throw new BadRequestException(
        `Invalid file ids: ${result.invalidFileIds.join(', ')}`,
      );
    }
  }
}
