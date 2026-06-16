import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostInput } from './dto/create-post.input';
import { Inject } from '@nestjs/common';
import { PostsPrismaService } from '../prisma/posts-prisma.service';
import { POSTS_RMQ_CLIENT } from './posts.constants';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PostsPrismaService,
    @Inject(POSTS_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  feed() {
    return this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.post.findUnique({ where: { id } });
  }

  async create(input: CreatePostInput) {
    const post = await this.prisma.post.create({
      data: {
        authorId: input.authorId,
        text: input.text,
        coverImageFileId: input.coverImageFileId,
      },
    });

    /*this.client.emit('post.created', {
      postId: post.id,
      authorId: post.authorId,
      coverImageFileId: post.coverImageFileId,
      createdAt: post.createdAt.toISOString(),
    });*/

    return post;
  }

  async findByAuthorId(authorId: string) {
    return this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
