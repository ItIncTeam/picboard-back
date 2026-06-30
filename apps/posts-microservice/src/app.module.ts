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
  normalizeContext,
  SubgraphAuthModule,
  SubgraphGatewayAuthMiddleware,
} from '@app/common';
import { AppConfig } from './config/app.config';

@Module({
  imports: [
    configModule,
    AppConfigModule,
    SubgraphAuthModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.postsSubgraphSecret,
      }),
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      path: '/api/v1',
      sortSchema: true,
      playground: true,
      context: ({ req }) => normalizeContext(req),
    }),
    PostsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SubgraphGatewayAuthMiddleware).forRoutes('*');
  }
}
