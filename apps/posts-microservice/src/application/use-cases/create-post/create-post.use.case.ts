import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { FilesServiceClient } from '../../../infrastructure/client/files-service.client';
import { PostEntity } from '../../../posts/entities/post.entity';
import { CreatePostInput } from '../../../posts/graphql/dto/create-post.input';

export class CreatePostCommand {
  constructor(
    public readonly input: CreatePostInput,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostUseCase implements ICommandHandler<CreatePostCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly filesClient: FilesServiceClient,
  ) {}

  async execute(command: CreatePostCommand): Promise<PostEntity> {
    const { input, ownerId } = command;

    await this.filesClient.assertAllOwnedReadyOrException(
      input.fileIds,
      ownerId,
    );

    return this.postsRepository.create({
      ownerId,
      description: input.description ?? null,
      fileIds: input.fileIds,
    });
  }
}
