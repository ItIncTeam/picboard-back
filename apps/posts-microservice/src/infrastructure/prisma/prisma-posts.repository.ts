import { Injectable } from '@nestjs/common';
import { PostsPrismaService, Prisma } from '../../prisma/posts-prisma.service';
import { PostMapper } from '../../domain/services/post-mapper';
import { PostsRepository } from '../../domain/repositories/posts.repository';
import { PostEntity } from '../../posts/entities/post.entity';
import { CreatePostData } from '../../domain/repositories/create-post-data';

@Injectable()
export class PrismaPostsRepository implements PostsRepository {
  constructor(private readonly prisma: PostsPrismaService) {}

  async findById(id: string): Promise<PostEntity | null> {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return PostMapper.toEntity(post);
  }

  async findByIds(ids: string[]): Promise<PostEntity[]> {
    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return PostMapper.toEntities(posts);
  }

  async findByOwnerId(ownerId: string): Promise<PostEntity[]> {
    const posts = await this.prisma.post.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return PostMapper.toEntities(posts);
  }
  //todo: infinity scroll
  async findFeed(): Promise<PostEntity[]> {
    const posts = await this.prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return PostMapper.toEntities(posts);
  }

  async findProfilePosts(
    ownerId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ posts: PostEntity[]; hasNextPage: boolean }> {
    const where: Prisma.PostWhereInput = { ownerId, deletedAt: null };
    if (cursor) {
      const [cursorDate, cursorId] = cursor.split('_');
      where.OR = [
        { createdAt: { lt: new Date(cursorDate) } },
        {
          createdAt: new Date(cursorDate),
          id: { lt: cursorId },
        },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });

    const hasNextPage = posts.length > limit;

    return {
      posts: PostMapper.toEntities(posts.slice(0, limit)),
      hasNextPage,
    };
  }

  async create(data: CreatePostData): Promise<PostEntity> {
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          ownerId: data.ownerId,
          description: data.description ?? null,
          attachments: {
            create: data.fileIds.map((fileId, index) => ({
              fileId,
              sortOrder: index,
            })),
          },
        },
        include: { attachments: { orderBy: { sortOrder: 'asc' } } },
      });
      return created;
    });

    return PostMapper.toEntity(post)!;
  }

  async updateDescription(
    id: string,
    description: string | null,
  ): Promise<PostEntity> {
    const updated = await this.prisma.post.update({
      where: { id },
      data: { description },
      include: { attachments: { orderBy: { sortOrder: 'asc' } } },
    });
    return PostMapper.toEntity(updated)!;
  }

  /**
   * Атомарно: soft-delete поста + постановка задачи на удаление его файлов
   * в outbox (одна транзакция). Файлы удаляются фоновым воркером.
   */
  async softDeleteAndEnqueueFileDeletion(
    postId: string,
    fileIds: string[],
    ownerId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });

      if (fileIds.length > 0) {
        await tx.fileDeletionOutbox.create({
          data: { postId, ownerId, fileIds },
        });
      }
    });
  }
}
