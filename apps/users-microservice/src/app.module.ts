//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { UsersModule } from './users/users.module';
import { AuthModule } from '@app/auth';
import { AppConfigModule } from './config/app-config.module';
import {
  createGraphqlFormatError,
  normalizeContext,
  SubgraphAuthModule,
  SubgraphGatewayAuthMiddleware,
} from '@app/common';
import { AppConfig } from './config/app.config';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';

@Module({
  imports: [
    configModule,
    AppConfigModule,
    SubgraphAuthModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.usersSubgraphSecret,
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
        introspection: true /*!appConfig.isProduction*/,
        sortSchema: true,
        playground: true /*!appConfig.isProduction*/,
        context: ({ req, res }) => ({
          dataloaderFactory: new DataloaderFactory(),
          ...normalizeContext(req, res),
        }),
        formatError: createGraphqlFormatError(appConfig.isProduction),
      }),
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SubgraphGatewayAuthMiddleware)
      .exclude({ path: 'api/v1/auth/(.*)', method: RequestMethod.GET })
      .forRoutes({ path: 'api/v1', method: RequestMethod.ALL });
  }
}
