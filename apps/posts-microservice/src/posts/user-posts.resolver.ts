import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { User } from './entities/user.stub';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

@Resolver(() => User)
export class UserPostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @ResolveField(() => [Post])
  async posts(@Parent() user: User) {
    return this.postsService.findByAuthorId(user.id);
  }
}
