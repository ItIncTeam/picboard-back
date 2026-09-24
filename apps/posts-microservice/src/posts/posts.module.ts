import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PostsResolver } from './graphql/posts.resolver';
import { PostsEventsController } from './posts.events.controller';
import { AppConfigModule } from '../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesServiceClient } from '../infrastructure/client/files-service.client';
import { PostAttachmentResolver } from './graphql/post-attachment.resolver';
import { PostAuthorResolver } from './graphql/post-author.resolver';
import { PostsRepository } from '../domain/repositories/posts.repository';
import { PrismaPostsRepository } from '../infrastructure/prisma/prisma-posts.repository';
import { CreatePostUseCase } from '../application/use-cases/create-post/create-post.use.case';
import { UpdatePostDescriptionUseCase } from '../application/use-cases/update-post-description/update-post-description.use.case';
import { DeletePostUseCase } from '../application/use-cases/delete-post/delete-post.use.case';
import { FileDeletionOutboxRepository } from '../domain/repositories/file-deletion-outbox.repository';
import { PrismaFileDeletionOutboxRepository } from '../infrastructure/prisma/prisma-file-deletion-outbox.repository';
import { FileDeletionOutboxWorker } from '../infrastructure/worker/file-deletion-outbox.worker';

@Module({
  imports: [AppConfigModule, CqrsModule, PrismaModule],
  providers: [
    PostsResolver,
    PostAttachmentResolver,
    PostAuthorResolver,
    FilesServiceClient,
    CreatePostUseCase,
    UpdatePostDescriptionUseCase,
    DeletePostUseCase,
    {
      provide: PostsRepository,
      useClass: PrismaPostsRepository,
    },
    {
      provide: FileDeletionOutboxRepository,
      useClass: PrismaFileDeletionOutboxRepository,
    },
    FileDeletionOutboxWorker,
  ],
  controllers: [PostsEventsController],
})
export class PostsModule {}
