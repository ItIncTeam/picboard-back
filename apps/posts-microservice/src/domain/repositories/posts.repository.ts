import { PostEntity } from '../../posts/entities/post.entity';
import { CreatePostData } from './create-post-data';

export abstract class PostsRepository {
  abstract findById(id: string): Promise<PostEntity | null>;
  abstract findByIds(ids: string[]): Promise<PostEntity[]>;
  abstract findByOwnerId(ownerId: string): Promise<PostEntity[]>;
  abstract findFeed(): Promise<PostEntity[]>;
  abstract findProfilePosts(
    ownerId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ posts: PostEntity[]; hasNextPage: boolean }>;
  abstract create(data: CreatePostData): Promise<PostEntity>;
  abstract updateDescription(
    id: string,
    description: string | null,
  ): Promise<PostEntity>;
  abstract softDelete(id: string): Promise<void>;
}
