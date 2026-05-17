//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { AppConfig } from './config/app.config';
import { AppConfigModule } from './config/app-config.module';

@Module({
  imports: [
    configModule,
    AppConfigModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        server: {
          cors: true,
          context: ({ req }) => ({
            req,
            user: req.user ?? null,
            token: req.headers.authorization ?? null,
          }),
        },
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: [
              { name: 'users', url: config.usersGqlUrl },
              { name: 'posts', url: config.postsGqlUrl },
              { name: 'files', url: config.filesGqlUrl },
            ],
          }),
          buildService: ({ url }) =>
            new RemoteGraphQLDataSource({
              url,
              willSendRequest({ request, context }) {
                const auth =
                  context.token ?? context.req?.headers?.authorization;

                if (auth) {
                  request.http?.headers.set('authorization', auth);
                }
              },
            }),
        },
      }),
    }),
  ],
})
export class AppModule {}
