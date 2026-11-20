import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export class DeletePostCommand {
  constructor(
    public readonly postId: string,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute(command: DeletePostCommand): Promise<void> {
    const { postId, ownerId } = command;

    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.ownerId !== ownerId) {
      throw new ForbiddenException('Access denied');
    }

    // Атомарно: soft-delete поста + задача на удаление файлов в outbox.
    // Доставку в files-сервис выполняет фоновый воркер (с ретраями),
    // поэтому удаление поста не зависит от доступности files.
    const fileIds = post.attachments.map((a) => a.fileId);
    await this.postsRepository.softDeleteAndEnqueueFileDeletion(
      postId,
      fileIds,
      ownerId,
    );
  }
}
