import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { User } from '../entities/user.stub';
import { PostsRepository } from '../../domain/repositories/posts.repository';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';

@Resolver(() => PostEntity)
export class PostAuthorResolver {
  constructor(private readonly postsRepository: PostsRepository) {}

  @ResolveField(() => User, { nullable: true })
  async author(
    @Parent() post: PostEntity,
    @Context() context: { dataloaderFactory: DataloaderFactory },
  ): Promise<User | null> {
    // Gateway передаёт только key-поля (id). ownerId недоступен в @Parent.
    // DataLoader батчит запросы по id — без N+1.
    const loader = context.dataloaderFactory.create<string, PostEntity>(
      'post-author',
      async (ids: string[]) => {
        const posts = await this.postsRepository.findByIds(ids);
        const postMap = new Map(posts.map((p) => [p.id, p]));
        return ids.map((id) => {
          const post = postMap.get(id);
          if (!post) {
            throw new NotFoundException('Post not found');
          }
          return post;
        });
      },
    );

    const fullPost = await loader.load(post.id);
    // Gateway сам до-загрузит username/displayName через resolveReference в users
    return { __typename: 'User', id: fullPost.ownerId } as User;
  }
}
