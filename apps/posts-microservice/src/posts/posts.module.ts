import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PostsResolver } from './graphql/posts.resolver';
import { PostsEventsController } from './posts.events.controller';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesServiceClient } from '../infrastructure/client/files-service.client';
import { PostAttachmentResolver } from './graphql/post-attachment.resolver';
import { PostsRepository } from '../domain/repositories/posts.repository';
import { PrismaPostsRepository } from '../infrastructure/prisma/prisma-posts.repository';
import { CreatePostUseCase } from '../application/use-cases/create-post/create-post.use.case';
import { UpdatePostDescriptionUseCase } from '../application/use-cases/update-post-description/update-post-description.use.case';
import { DeletePostUseCase } from '../application/use-cases/delete-post/delete-post.use.case';

@Module({
  imports: [
    AppConfigModule,
    CqrsModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.jwtAccessSecret,
        signOptions: {
          expiresIn: appConfig.jwtAccessExpiresIn,
        },
      }),
    }),
    PrismaModule,
  ],
  providers: [
    PostsResolver,
    PostAttachmentResolver,
    FilesServiceClient,
    CreatePostUseCase,
    UpdatePostDescriptionUseCase,
    DeletePostUseCase,
    {
      provide: PostsRepository,
      useClass: PrismaPostsRepository,
    },
  ],
  controllers: [PostsEventsController],
})
export class PostsModule {}
