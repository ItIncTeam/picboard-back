import { Controller, Logger, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QueryBus } from '@nestjs/cqrs';
import { CheckOwnedReadyFilesQuery } from '../../application/handlers/check-owned-ready-files/check-owned-ready-files.handler';
import {
  CheckOwnedReadyFilesDto,
  CheckOwnedReadyFilesResponse,
  FILES_TCP_PATTERNS,
} from '@app/contracts';
import { createRpcValidationPipe } from '@app/common/validation/create-rpc-validation-pipe';

@Controller()
export class FilesTcpController {
  private readonly logger = new Logger(FilesTcpController.name);
  constructor(private readonly queryBus: QueryBus) {}
  @MessagePattern(FILES_TCP_PATTERNS.CHECK_OWNED_READY)
  @UsePipes(createRpcValidationPipe())
  async checkOwnedReady(
    @Payload() payload: CheckOwnedReadyFilesDto,
  ): Promise<CheckOwnedReadyFilesResponse> {
    return await this.queryBus.execute(
      new CheckOwnedReadyFilesQuery(payload.ownerId, payload.fileIds),
    );
  }

  /* ILYA
  * import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { FilesTcpClient } from './files-tcp.client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'FILES_TCP_CLIENT',
        transport: Transport.TCP,
        options: {
          host: process.env.FILES_MS_HOST,
          port: Number(process.env.FILES_MS_TCP_PORT),
        },
      },
    ]),
  ],
  providers: [FilesTcpClient],
  exports: [FilesTcpClient],
})
export class FilesClientModule {}
*
* import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, TimeoutError, timeout } from 'rxjs';
import {
  CheckOwnedReadyFilesDto,
  CheckOwnedReadyFilesResponse,
  FILES_TCP_PATTERNS,
} from '@app/contracts/files/check-owned-ready-files.contract';

@Injectable()
export class FilesTcpClient {
  constructor(
    @Inject('FILES_TCP_CLIENT')
    private readonly client: ClientProxy,
  ) {}

  async checkOwnedReadyFiles(
    payload: CheckOwnedReadyFilesDto,
  ): Promise<CheckOwnedReadyFilesResponse> {
    try {
      return await firstValueFrom(
        this.client
          .send<CheckOwnedReadyFilesResponse>(
            FILES_TCP_PATTERNS.CHECK_OWNED_READY,
            payload,
          )
          .pipe(timeout(5000)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new ServiceUnavailableException('Files service timeout');
      }

      throw new ServiceUnavailableException('Files service unavailable');
    }
  }

  async assertAllOwnedReady(ownerId: string, fileIds: string[]): Promise<void> {
    const uniqueFileIds = [...new Set(fileIds)];

    const result = await this.checkOwnedReadyFiles({
      ownerId,
      fileIds: uniqueFileIds,
    });

    if (result.invalidFileIds.length > 0) {
      throw new BadRequestException(
        `Invalid file ids: ${result.invalidFileIds.join(', ')}`,
      );
    }
  }
}
*
* import { Injectable } from '@nestjs/common';
import { FilesTcpClient } from '../../../files-client/files-tcp.client';

@Injectable()
export class CreatePostUseCase {
  constructor(
    private readonly filesTcpClient: FilesTcpClient,
  ) {}

  async execute(ownerId: string, fileIds: string[]) {
    await this.filesTcpClient.assertAllOwnedReady(ownerId, fileIds);

    // continue with post creation:
    // 1. create post
    // 2. create post attachments
    // 3. persist sortOrder, etc.
  }
}*/
}
