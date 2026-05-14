import { Module } from '@nestjs/common';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';
import { RmqModule } from '@app/rmq';
import { PostsEventsController } from './posts.events.controller';
import { PostsPrismaService } from '../prisma/posts-prisma.service';
import { UserPostsResolver } from './user-posts.resolver';

@Module({
  imports: [RmqModule.register()],
  providers: [
    PostsResolver,
    PostsService,
    UserPostsResolver,
    PostsPrismaService,
  ],
  controllers: [PostsEventsController],
})
export class PostsModule {}
