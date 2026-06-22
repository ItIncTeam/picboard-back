import {
  Args,
  Context,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '@app/auth';
import { PostsService } from './posts.service';
import { PostEntity } from './entities/post.entity';
import { PostConnection } from './entities/post-connection.entity';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostDescriptionInput } from './dto/update-post-description.input';
import { DeletePostInput } from './dto/delete-post.input';
import { ProfilePostsInput } from './dto/profile-posts.input';

@Resolver(() => PostEntity)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @Query(() => [PostEntity])
  feed() {
    return this.postsService.feed();
  }

  @Query(() => PostEntity, { nullable: true })
  post(@Args('id') id: string) {
    return this.postsService.findById(id);
  }

  @Query(() => PostConnection)
  profilePosts(@Args('input') input: ProfilePostsInput) {
    return this.postsService.profilePosts(input);
  }

  @UseGuards(GqlJwtAuthGuard)
  @Mutation(() => PostEntity)
  createPost(@Args('input') input: CreatePostInput, @Context() context: any) {
    const authHeader = context.req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    return this.postsService.createPost(input, context.req.user.userId, token);
  }

  @UseGuards(GqlJwtAuthGuard)
  @Mutation(() => PostEntity)
  updatePostDescription(
    @Args('input') input: UpdatePostDescriptionInput,
    @Context() context: any,
  ) {
    return this.postsService.updatePostDescription(
      input,
      context.req.user.userId,
    );
  }

  @UseGuards(GqlJwtAuthGuard)
  @Mutation(() => Boolean)
  deletePost(@Args('input') input: DeletePostInput, @Context() context: any) {
    return this.postsService.deletePost(input, context.req.user.userId);
  }

  @ResolveField(() => String, { name: 'author' })
  resolveAuthor(@Parent() post: PostEntity) {
    return { __typename: 'User', id: post.ownerId };
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return this.postsService.findById(reference.id);
  }
}
