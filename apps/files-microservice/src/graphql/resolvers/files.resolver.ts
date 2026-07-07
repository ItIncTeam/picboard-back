import {
  Args,
  Mutation,
  ResolveReference,
  Resolver,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { File } from '../types/file.type';
import { InitiateUploadInput } from '../inputs/initiate-upload.input';
import { InitiateUploadPayload } from '../types/payloads/initiate-upload.payload';
import { CommandBus } from '@nestjs/cqrs';
import { InitiateUploadBatchCommand } from '../../application/use-cases/initiate-upload/initiate-upload-batch.use.case';
import { CurrentUserId } from '@app/common';
import { CompleteUploadPayload } from '../types/payloads/complete-upload.payload';
import { CompleteUploadInput } from '../inputs/complete-upload.input';
import { CompleteUploadBatchCommand } from '../../application/use-cases/complete-upload/complete-upload-batch.use.case';
import { Logger, NotFoundException } from '@nestjs/common';
import { ResolveFileUrlCommand } from '../../application/use-cases/resolve-file-url/resolve-file-url.use.case';
import { FilesRepository } from '../../domain/repositories/files/files.repository';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { FileEntity } from '../../domain/entities/file.entity';

@Resolver(() => File)
export class FilesResolver {
  private readonly logger = new Logger(FilesResolver.name);
  constructor(
    private readonly commandBus: CommandBus,
    private readonly filesRepository: FilesRepository,
  ) {}

  @Mutation(() => [InitiateUploadPayload])
  initiateUploadBatch(
    @CurrentUserId() ownerId: string,
    @Args('input', { type: () => [InitiateUploadInput] })
    input: InitiateUploadInput[],
  ): Promise<InitiateUploadPayload[]> {
    return this.commandBus.execute(
      new InitiateUploadBatchCommand(input, ownerId),
    );
  }

  @Mutation(() => [CompleteUploadPayload])
  completeUpload(
    @CurrentUserId() ownerId: string,
    @Args('input', { type: () => [CompleteUploadInput] })
    input: CompleteUploadInput[],
  ): Promise<CompleteUploadPayload[]> {
    return this.commandBus.execute(
      new CompleteUploadBatchCommand(
        input.map((item) => item.fileId),
        ownerId,
      ),
    );
  }

  //resolve entire File entity by @key (from gateway)
  //return file or null now
  @ResolveReference()
  /*async */
  resolveFile(
    /*@Parent() */ reference: {
      __typename: string;
      id: string;
    },
    /*@Context() */ context: { dataloaderFactory: DataloaderFactory },
  ): Promise<FileEntity> {
    this.logger.debug(`Resolving File reference. fileId=${reference.id}`);

    if (!reference?.id) {
      throw new NotFoundException('File ID was not provided');
    }
    /*return await this.queryBus.execute(new GetFileByIdQuery(reference.id));*/

    const loader = context.dataloaderFactory.create<
      string,
      FileEntity /* | null*/
    >('files', async (ids: string[]) => {
      const files = await this.filesRepository.findByIds(ids);
      const fileMap = new Map(files.map((f) => [f.id, f]));
      return ids.map((id) => {
        const file = fileMap.get(id);
        if (!file) {
          this.logger.warn(`Referenced file not found. fileId=${id}`);
          throw new NotFoundException('File not found');
        }
        return file /* ?? null*/;
      });
    });
    return loader.load(reference.id);
  }

  // resolve url field on File entity
  // field resolver for url - called when frontend accesses file.url
  @ResolveField(() => String, { nullable: true })
  url(@Parent() file: File): Promise<string> | null {
    //todo: think about it, returns null
    if (!file) return null;
    return this.commandBus.execute(new ResolveFileUrlCommand(file));
  }
}
