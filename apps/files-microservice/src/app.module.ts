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
import { FilesModule } from './files/files.module';
import { File } from '../src/graphql/types/file.type';
import {
  createGraphqlFormatError,
  normalizeContext,
  SubgraphAuthModule,
  SubgraphGatewayAuthMiddleware,
} from '@app/common';
import { AppConfigModule } from './config/app-config.module';
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
        secret: appConfig.filesSubgraphSecret,
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
        buildSchemaOptions: {
          orphanedTypes: [File],
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
    FilesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SubgraphGatewayAuthMiddleware)
      .forRoutes({ path: 'api/v1', method: RequestMethod.ALL });
  }
}
