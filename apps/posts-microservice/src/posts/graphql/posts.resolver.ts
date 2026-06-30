import {
  Args,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { PostsService } from '../posts.service';
import { PostEntity } from '../entities/post.entity';
import { PostConnection } from '../entities/post-connection.entity';
import { CreatePostInput } from '../dto/create-post.input';
import { UpdatePostDescriptionInput } from '../dto/update-post-description.input';
import { DeletePostInput } from '../dto/delete-post.input';
import { ProfilePostsInput } from '../dto/profile-posts.input';
import { CurrentUserId } from '@app/common';

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

  // todo: переходим на получение UserId от gateway в декораторе @CurrentUserId()
  @Mutation(() => PostEntity)
  createPost(
    @Args('input') input: CreatePostInput,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.createPost(input, userId);
  }

  @Mutation(() => PostEntity)
  updatePostDescription(
    @Args('input') input: UpdatePostDescriptionInput,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.updatePostDescription(input, userId);
  }

  @Mutation(() => Boolean)
  deletePost(
    @Args('input') input: DeletePostInput,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.deletePost(input, userId);
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return this.postsService.findById(reference.id);
  }
}
