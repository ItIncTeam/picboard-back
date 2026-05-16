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

@Module({
  imports: [
    configModule,
    AppConfigModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
