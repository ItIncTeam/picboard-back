import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.gateway' }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
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
              { name: 'users', url: config.getOrThrow('USERS_GQL_URL') },
              { name: 'posts', url: config.getOrThrow('POSTS_GQL_URL') },
              { name: 'files', url: config.getOrThrow('FILES_GQL_URL') },
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
