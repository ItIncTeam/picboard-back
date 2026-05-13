import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostInput } from './dto/create-post.input';
import { Inject } from '@nestjs/common';
import { PostsPrismaService } from '../prisma/posts-prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PostsPrismaService,
    @Inject('RMQ_SERVICE') private readonly rmqClient: ClientProxy,
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

    this.rmqClient.emit('post.created', {
      postId: post.id,
      authorId: post.authorId,
      coverImageFileId: post.coverImageFileId,
      createdAt: post.createdAt.toISOString(),
    });

    return post;
  }
}
