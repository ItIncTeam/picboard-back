import { Module } from '@nestjs/common';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';
// import { RmqModule } from '@app/rmq';
import { PostsEventsController } from './posts.events.controller';
import { UserPostsResolver } from './user-posts.resolver';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { JwtModule } from '@nestjs/jwt';
// import { POSTS_RMQ_CLIENT } from './posts.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesServiceClient } from './client/files-service.client';
import { PostAttachmentResolver } from './entities/post-attachment.entity';

@Module({
  imports: [
    AppConfigModule,
    // RmqModule.registerAsync({
    //   name: POSTS_RMQ_CLIENT,
    //   imports: [AppConfigModule],
    //   inject: [AppConfig],
    //   useFactory: (appConfig: AppConfig) => ({
    //     url: appConfig.rabbitMqUrl,
    //     queue: appConfig.rabbitMqQueue,
    //   }),
    // }),
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
    PostsService,
    UserPostsResolver,
    FilesServiceClient,
    PostAttachmentResolver,
  ],
  controllers: [PostsEventsController],
})
export class PostsModule {}
