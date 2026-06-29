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
import { SubgraphGatewayAuthMiddleware } from './common/subgraph-gateway-auth.middleware';
import { normalizeContext } from '@app/common';

@Module({
  imports: [
    configModule,
    AppConfigModule,
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
  configure(consumer: MiddlewareConsumer): any {
    consumer.apply(SubgraphGatewayAuthMiddleware).forRoutes('*');
  }
}
