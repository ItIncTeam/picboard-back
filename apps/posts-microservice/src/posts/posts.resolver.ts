import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';
import { CreatePostInput } from './dto/create-post.input';
import { User } from './entities/user.stub';
import { FileAsset } from './entities/file-asset.stub';

@Resolver(() => Post)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @Query(() => [Post])
  feed() {
    return this.postsService.feed();
  }

  @Query(() => Post, { nullable: true })
  post(@Args('id') id: string) {
    return this.postsService.findById(id);
  }

  @Mutation(() => Post)
  createPost(@Args('input') input: CreatePostInput) {
    return this.postsService.create(input);
  }

  @ResolveField(() => User)
  author(@Parent() post: Post) {
    return { __typename: 'User', id: post.authorId };
  }

  @ResolveField(() => FileAsset, { nullable: true })
  coverImage(@Parent() post: Post) {
    return post.coverImageFileId
      ? { __typename: 'FileAsset', id: post.coverImageFileId }
      : null;
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return this.postsService.findById(reference.id);
  }
}
