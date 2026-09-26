import { Controller, Logger, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CheckOwnedReadyFilesQuery } from '../../application/handlers/check-owned-ready-files/check-owned-ready-files.handler';
import {
  CheckOwnedReadyFilesDto,
  CheckOwnedReadyFilesResponse,
  FILES_TCP_PATTERNS,
  SoftDeleteFilesInput,
  SoftDeleteResponse,
} from '@app/contracts';
import { createRpcValidationPipe } from '@app/common/validation/create-rpc-validation-pipe';
import { SoftDeleteFilesCommand } from '../../application/use-cases/soft-delete-files/soft-delete-files.use.case';

@Controller()
export class FilesTcpController {
  private readonly logger = new Logger(FilesTcpController.name);
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @MessagePattern(FILES_TCP_PATTERNS.CHECK_OWNED_READY)
  @UsePipes(createRpcValidationPipe())
  async checkOwnedReady(
    @Payload() payload: CheckOwnedReadyFilesDto,
  ): Promise<CheckOwnedReadyFilesResponse> {
    const startedAt = Date.now();

    this.logger.log(
      `TCP CHECK_OWNED_READY received ownerId=${payload.ownerId} fileIdsCount=${payload.fileIds.length} fileIds=${JSON.stringify(payload.fileIds)}`,
    );

    const result = await this.queryBus.execute(
      new CheckOwnedReadyFilesQuery(payload.ownerId, payload.fileIds),
    );

    this.logger.log(
      `TCP CHECK_OWNED_READY completed ownerId=${payload.ownerId} requestedCount=${payload.fileIds.length} validCount=${result.validFileIds.length} invalidCount=${result.invalidFileIds.length} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  @MessagePattern(FILES_TCP_PATTERNS.MARK_FILES_DELETED)
  @UsePipes(createRpcValidationPipe())
  async softDeleteMany(
    @Payload() payload: SoftDeleteFilesInput,
  ): Promise<SoftDeleteResponse> {
    const startedAt = Date.now();

    this.logger.log(
      `TCP SOFT_DELETE_FILES received ownerId=${payload.ownerId} fileIdsCount=${payload.fileIds.length}`,
    );

    const result = await this.commandBus.execute(
      new SoftDeleteFilesCommand(payload.ownerId, payload.fileIds),
    );

    this.logger.log(
      `TCP SOFT_DELETE_FILES completed ownerId=${payload.ownerId} requestedCount=${payload.fileIds.length} softDeletedCount=${result.count} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }
}
