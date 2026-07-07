import {
  Args,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
  Context,
} from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { PostEntity } from '../entities/post.entity';
import { PostConnection } from '../entities/post-connection.entity';
import { PostEdge } from '../entities/post-edge.entity';
import { PageInfo } from '../entities/page-info.entity';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostDescriptionInput } from './dto/update-post-description.input';
import { DeletePostInput } from './dto/delete-post.input';
import { ProfilePostsInput } from './dto/profile-posts.input';
import { CurrentUserId } from '@app/common';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { PostsRepository } from '../../domain/repositories/posts.repository';
import { CreatePostCommand } from '../../application/use-cases/create-post/create-post.use.case';
import { UpdatePostDescriptionCommand } from '../../application/use-cases/update-post-description/update-post-description.use.case';
import { DeletePostCommand } from '../../application/use-cases/delete-post/delete-post.use.case';

@Resolver(() => PostEntity)
export class PostsResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly postsRepository: PostsRepository,
  ) {}

  @Query(() => [PostEntity])
  feed() {
    return this.postsRepository.findFeed();
  }

  @Query(() => PostEntity, { nullable: true })
  post(@Args('id') id: string) {
    return this.postsRepository.findById(id);
  }

  @Query(() => PostConnection)
  async profilePosts(@Args('input') input: ProfilePostsInput): Promise<PostConnection> {
    const limit = input.first ?? 8;
    const result = await this.postsRepository.findProfilePosts(
      input.userId,
      limit,
      input.after ?? undefined,
    );

    const edges: PostEdge[] = result.posts.map((post) => ({
      cursor: `${post.createdAt.toISOString()}_${post.id}`,
      node: post,
    }));

    const pageInfo: PageInfo = {
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
      hasNextPage: result.hasNextPage,
    };

    return { edges, pageInfo };
  }

  @Mutation(() => PostEntity)
  createPost(
    @Args('input') input: CreatePostInput,
    @CurrentUserId() userId: string,
  ) {
    return this.commandBus.execute(new CreatePostCommand(input, userId));
  }

  @Mutation(() => PostEntity)
  updatePostDescription(
    @Args('input') input: UpdatePostDescriptionInput,
    @CurrentUserId() userId: string,
  ) {
    return this.commandBus.execute(
      new UpdatePostDescriptionCommand(input, userId),
    );
  }

  @Mutation(() => Boolean)
  async deletePost(
    @Args('input') input: DeletePostInput,
    @CurrentUserId() userId: string,
  ): Promise<boolean> {
    await this.commandBus.execute(new DeletePostCommand(input.postId, userId));
    return true;
  }

  @ResolveReference()
  async resolveReference(
    reference: { __typename: string; id: string },
    @Context() context: { dataloaderFactory: DataloaderFactory },
  ): Promise<PostEntity | null> {
    if (!reference?.id) {
      return null;
    }

    const loader = context.dataloaderFactory.create<string, PostEntity | null>(
      'posts',
      async (ids: string[]) => {
        const posts = await this.postsRepository.findByIds(ids);
        const postMap = new Map(posts.map((p) => [p.id, p]));
        return ids.map((id) => postMap.get(id) ?? null);
      },
    );
    return loader.load(reference.id);
  }
}
