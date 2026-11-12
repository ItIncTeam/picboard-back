import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientTCP } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { mapRpcErrorToHttpException } from '@app/common/rpc/map-rpc-error-to-http';
import { FileDeletionSender } from '@app/common/file-deletion-outbox/file-deletion-sender';
import {
  CheckOwnedReadyFilesDto,
  CheckOwnedReadyFilesResponse,
  FILES_TCP_PATTERNS,
  SoftDeleteFilesInput,
} from '@app/contracts';
import { AppConfig } from '../../config/app.config';
import { FilesService } from '../../domain/services/files.service';

const FILES_TCP_TIMEOUT_MS = 5000;

@Injectable()
export class FilesServiceClient implements FilesService, FileDeletionSender {
  private readonly client: ClientProxy;

  constructor(appConfig: AppConfig) {
    this.client = new ClientTCP({
      host: appConfig.filesTcpHost,
      port: appConfig.filesTcpPort,
    });
  }

  async isOwnedReadyAvatar(fileId: string, ownerId: string): Promise<boolean> {
    const payload: CheckOwnedReadyFilesDto = {
      ownerId,
      fileIds: [fileId],
      purpose: 'AVATAR',
    };

    try {
      const result = await firstValueFrom(
        this.client
          .send<CheckOwnedReadyFilesResponse>(
            FILES_TCP_PATTERNS.CHECK_OWNED_READY,
            payload,
          )
          .pipe(timeout(FILES_TCP_TIMEOUT_MS)),
      );
      return result.validFileIds.includes(fileId);
    } catch (error) {
      throw mapRpcErrorToHttpException(error, {
        serviceLabel: 'Files service',
      });
    }
  }

  // Errors propagate as received: the outbox worker tells a permanent 4xx
  // from a failure worth retrying by the raw RPC payload
  async markFilesDeleted(input: SoftDeleteFilesInput): Promise<void> {
    await firstValueFrom(
      this.client
        .send(FILES_TCP_PATTERNS.MARK_FILES_DELETED, {
          ownerId: input.ownerId,
          fileIds: input.fileIds,
        })
        .pipe(timeout(FILES_TCP_TIMEOUT_MS)),
    );
  }
}
