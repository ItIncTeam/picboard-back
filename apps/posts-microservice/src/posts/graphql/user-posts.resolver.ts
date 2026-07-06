import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PostsRepository } from '../../domain/repositories/posts.repository';
import { User } from '../entities/user.stub';

@Resolver('User')
export class UserPostsResolver {
  constructor(private readonly postsRepository: PostsRepository) {}

  @ResolveField('posts')
  async getPosts(@Parent() user: User) {
    return this.postsRepository.findByOwnerId(user.id);
  }
}
