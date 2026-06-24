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
import { InitiateUploadPayload } from '../types/initiateUpload.payload';
import { CommandBus } from '@nestjs/cqrs';
import { InitiateUploadBatchCommand } from '../../application/use-cases/initiate-upload/initiate-upload-batch.use.case';
import { CurrentUserId } from '@app/common';
import { CompleteUploadPayload } from '../types/complete-upload.payload';
import { CompleteUploadInput } from '../inputs/complete-upload.input';
import { CompleteUploadBatchCommand } from '../../application/use-cases/complete-upload/complete-upload-batch.use.case';
import { Logger, NotFoundException } from '@nestjs/common';
import { ResolveFileUrlCommand } from '../../application/use-cases/resolve-file-url/resolve-file-url.use.case';
import { FilesRepository } from '../../domain/repositories/files/files.repository';

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
  @ResolveReference()
  async resolveFile(reference: {
    __typename: string;
    id: string;
  }): Promise<File> {
    this.logger.debug(`Resolving File reference. fileId=${reference.id}`);

    const file = await this.filesRepository.findById(reference.id);
    if (!file) {
      this.logger.warn(`Referenced file not found. fileId=${reference.id}`);
      throw new NotFoundException('File not found');
    }

    return file;
  }

  // resolve url field on File entity
  // field resolver for url - called when frontend accesses file.url
  @ResolveField(() => String)
  async url(@Parent() file: File): Promise<string> {
    return this.commandBus.execute(new ResolveFileUrlCommand(file));
  }

  /*if (!file.storageKey) {
      throw new ForbiddenException('Storage key not available');
    }

    // Verify S3 existence
    try {
      await this.s3Service.client
        .headObject({
          Bucket: 'your-bucket-name',
          Key: file.storageKey,
        })
        .promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        throw new ForbiddenException(`File not found in S3`);
      }
      throw error;
    }

    const command = new GetObjectCommand({
      Bucket: 'your-bucket-name',
      Key: file.storageKey,
    });

    return await getSignedUrl(this.s3Service.client, command, {
      expiresInSeconds: 3600,
    });
  }*/

  /*//Ilya
    @ObjectType()
export class PostAttachmentModel {
  @Field(() => ID)
  fileId: string;
  @Field()
  sortOrder: number;
  @Field(() => FileModel)
  file: FileModel; // This triggers resolveFile() via @ResolveReference()
}

@Resolver(() => PostAttachmentModel)
export class PostAttachmentResolver {
  @Field(() => FileModel)
  async file(@Root() attachment: PostAttachmentModel): Promise<FileModel> {
    // Returns { __typename: "File", id: attachment.fileId }
    // Gateway calls @ResolveReference() in FileResolver
    return { id: attachment.fileId } as FileModel;
  }
}

# Post microservice schema
type Post {
  id: ID!
  attachments: [PostAttachment!]!
}

type PostAttachment {
  fileId: ID!
  sortOrder: Int!
  file: File!  # ← Reference to File entity from File microservice
}

# File microservice schema (with @key)
type File @key(fields: "id") {
  id: ID!
  url: String!  # ← Computed via @ResolveField
}
*/
}
