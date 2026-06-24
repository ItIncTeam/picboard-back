import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';
import { ClientProxy, ClientTCP } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface ValidateFilesResponse {
  validFileIds: string[];
  missingFileIds: string[];
  notOwnedFileIds: string[];
  notReadyFileIds: string[];
  allValid: boolean;
}

@Injectable()
export class FilesServiceClient {
  private client: ClientProxy;

  constructor(private readonly appConfig: AppConfig) {
    this.client = new ClientTCP({
      port: 4000, //todo: вынести в .env
      host: 'files-service', // todo: имя Docker-hostname, для локальной работы localhost
    });
  }

  async validateOwnedFiles(
    fileIds: string[],
    ownerId: string,
  ): Promise<ValidateFilesResponse> {
    return firstValueFrom(
      this.client.send({ cmd: 'validate_for_post' }, { fileIds, ownerId }), // todo: взять из lib константанту FILES_TCP_PATTERNS взять input/output models
    );
  }
}
