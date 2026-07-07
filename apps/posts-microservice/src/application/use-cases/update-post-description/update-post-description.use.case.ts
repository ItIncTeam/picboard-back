import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { PostEntity } from '../../../posts/entities/post.entity';
import { UpdatePostDescriptionInput } from '../../../posts/graphql/dto/update-post-description.input';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export class UpdatePostDescriptionCommand {
  constructor(
    public readonly input: UpdatePostDescriptionInput,
    public readonly ownerId: string,
  ) {}
}

@CommandHandler(UpdatePostDescriptionCommand)
export class UpdatePostDescriptionUseCase implements ICommandHandler<UpdatePostDescriptionCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute(command: UpdatePostDescriptionCommand): Promise<PostEntity> {
    const { input, ownerId } = command;

    const post = await this.postsRepository.findById(input.postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.ownerId !== ownerId) {
      throw new ForbiddenException('Access denied');
    }

    return this.postsRepository.updateDescription(
      input.postId,
      input.description ?? null,
    );
  }
}
