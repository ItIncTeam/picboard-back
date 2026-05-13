import { Module } from '@nestjs/common';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';
import { RmqModule } from '@app/rmq';
import { PostsEventsController } from './posts.events.controller';
import { PostsPrismaService } from '../prisma/posts-prisma.service';

@Module({
  imports: [RmqModule.register()],
  providers: [PostsResolver, PostsService, PostsPrismaService],
  controllers: [PostsEventsController],
})
export class PostsModule {}
