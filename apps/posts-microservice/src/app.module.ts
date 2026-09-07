//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { PostsModule } from './posts/posts.module';
import { AppConfigModule } from './config/app-config.module';
import {
  createGraphqlFormatError,
  normalizeContext,
  SubgraphAuthModule,
  SubgraphGatewayAuthMiddleware,
  PrismaExceptionModule,
} from '@app/common';
import { AppConfig } from './config/app.config';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';

@Module({
  imports: [
    configModule,
    AppConfigModule,
    PrismaExceptionModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        exposeErrorCode: !appConfig.isProduction,
      }),
    }),
    SubgraphAuthModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.postsSubgraphSecret,
      }),
    }),
    GraphQLModule.forRootAsync<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        autoSchemaFile: {
          federation: 2,
        },
        path: '/api/v1',
        sortSchema: true,
        playground: true,
        formatError: createGraphqlFormatError(appConfig.isProduction),
        context: ({ req, res }) => ({
          dataloaderFactory: new DataloaderFactory(),
          ...normalizeContext(req, res),
        }),
      }),
    }),
    PostsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SubgraphGatewayAuthMiddleware).forRoutes('*');
  }
}
