import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { FilesServiceClient } from '../../../infrastructure/client/files-service.client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export class DeletePostCommand {
  constructor(
    public readonly postId: string,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly filesClient: FilesServiceClient,
  ) {}

  async execute(command: DeletePostCommand): Promise<void> {
    const { postId, ownerId } = command;

    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.ownerId !== ownerId) {
      throw new ForbiddenException('Access denied');
    }

    await this.postsRepository.softDelete(postId);

    const fileIds = post.attachments.map((a) => a.fileId);
    this.filesClient.markFilesDeleted({ fileIds, ownerId });
  }
}
