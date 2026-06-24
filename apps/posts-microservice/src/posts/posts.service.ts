import { Injectable } from '@nestjs/common';
import { PostsPrismaService } from '../prisma/posts-prisma.service';
import { FilesServiceClient } from './client/files-service.client';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostDescriptionInput } from './dto/update-post-description.input';
import { DeletePostInput } from './dto/delete-post.input';
import { ProfilePostsInput } from './dto/profile-posts.input';
import { PostEntity } from './entities/post.entity';
import { PostConnection } from './entities/post-connection.entity';
import { PageInfo } from './entities/page-info.entity';
import { POST_RULES } from './posts.constants';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PostsPrismaService,
    private readonly filesClient: FilesServiceClient,
  ) {}

  /** Публичная лента — 4 последних поста */
  async feed() {
    const posts = await this.prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return posts.map(this.toPostModel);
  }

  /** Поиск поста по ID */
  async findById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return post ? this.toPostModel(post) : null;
  }

  /** Создание поста с валидацией файлов через files-service */
  async createPost(input: CreatePostInput, ownerId: string) {
    const result = await this.filesClient.validateOwnedFiles(
      input.fileIds,
      ownerId,
    );

    if (!result.allValid) {
      const errors: string[] = [];
      if (result.missingFileIds.length)
        errors.push(`not found: ${result.missingFileIds}`);
      if (result.notOwnedFileIds.length)
        errors.push(`not owned: ${result.notOwnedFileIds}`);
      if (result.notReadyFileIds.length)
        errors.push(`not ready: ${result.notReadyFileIds}}`);
      throw new Error(`Files validation failed: ${errors.join('; ')}`);
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          ownerId,
          description: input.description ?? null,
          attachments: {
            create: input.fileIds.map((fileId, index) => ({
              fileId,
              sortOrder: index,
            })),
          },
        },
        include: { attachments: { orderBy: { sortOrder: 'asc' } } },
      });
      return created;
    });

    return this.toPostModel(post);
  }

  /** Обновление только описания */
  async updatePostDescription(
    input: UpdatePostDescriptionInput,
    ownerId: string,
  ) {
    const existing = await this.prisma.post.findFirst({
      where: { id: input.postId, ownerId, deletedAt: null },
    });
    if (!existing) throw new Error('Post not found or access denied');

    const updated = await this.prisma.post.update({
      where: { id: input.postId },
      data: { description: input.description ?? null },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toPostModel(updated);
  }

  /** Мягкое удаление */
  async deletePost(input: DeletePostInput, ownerId: string) {
    const existing = await this.prisma.post.findFirst({
      where: { id: input.postId, ownerId, deletedAt: null },
    });
    if (!existing) throw new Error('Post not found or access denied');

    await this.prisma.post.update({
      where: { id: input.postId },
      data: { deletedAt: new Date() },
    });
    return true;
  }

  /** Курсорная пагинация постов пользователя */
  async profilePosts(input: ProfilePostsInput) {
    const limit = input.first ?? POST_RULES.PROFILE_POSTS_PAGE_SIZE;
    const cursor = input.after;

    const where: any = { ownerId: input.userId, deletedAt: null };
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });

    const hasNextPage = posts.length > limit;
    const edges = posts.slice(0, limit).map((post) => ({
      cursor: post.createdAt.toISOString(),
      node: this.toPostModel(post),
    }));

    const pageInfo: PageInfo = {
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
      hasNextPage,
    };

    return { edges, pageInfo };
  }

  /** Поиск постов пользователя (для User.posts resolve field) */
  async findByOwnerId(ownerId: string) {
    const posts = await this.prisma.post.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return posts.map(this.toPostModel);
  }

  private toPostModel(post: any): PostEntity {
    return {
      id: post.id,
      ownerId: post.ownerId,
      description: post.description ?? undefined,
      attachments:
        post.attachments?.map((a: any) => ({
          fileId: a.fileId,
          sortOrder: a.sortOrder,
        })) ?? [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
