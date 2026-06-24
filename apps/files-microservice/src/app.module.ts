import { configModule } from './dynamic-config.module';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { FilesModule } from './files/files.module';
import { File } from '../src/graphql/types/file.type';
@Module({
  imports: [
    configModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      buildSchemaOptions: {
        orphanedTypes: [File],
      },
      path: '/api/v1',
      introspection: true,
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    FilesModule,
  ],
})
export class AppModule {}
