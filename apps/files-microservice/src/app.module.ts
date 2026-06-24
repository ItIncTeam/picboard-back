import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { FilesModule } from './files/files.module';
import { configModule } from './dynamic-config.module';
import { AuthModule } from '@app/auth';

@Module({
  imports: [
    configModule,
    AuthModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      introspection: true,
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    FilesModule,
  ],
})
export class AppModule {}
