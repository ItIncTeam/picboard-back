//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { UsersModule } from './users/users.module';
import { AuthModule } from '@app/auth';
import { AppConfigModule } from './config/app-config.module';
import { createGraphqlFormatError } from '@app/common';
import { AppConfig } from './config/app.config';

@Module({
  imports: [
    configModule,
    AppConfigModule,
    GraphQLModule.forRootAsync<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        autoSchemaFile: {
          federation: 2,
        },
        path: '/api/v1',
        introspection: true,
        sortSchema: true,
        playground: true,
        context: ({ req }) => ({ req }),
        formatError: createGraphqlFormatError(appConfig.isProduction),
      }),
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
