import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PostsService } from './posts.service';

@Resolver('User')
export class UserPostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @ResolveField('posts')
  async getPosts(@Parent() user: any) {
    return this.postsService.findByOwnerId(user.id);
  }
}
