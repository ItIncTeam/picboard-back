//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';
import { AppConfig } from './config/app.config';
import { AppConfigModule } from './config/app-config.module';
import type { Response } from 'express';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { CookieForwardingDataSource } from './auth/authenticated-data-source';

/**
 * Custom DataSource that forwards cookies from the client to the subgraph
 * and Set-Cookie from the subgraph back to the client.
 *
 * Without this:
 * - req.cookies in the subgraph is always empty (gateway doesn't forward cookies)
 * - res.cookie / res.clearCookie in the subgraph don't work (gateway doesn't forward Set-Cookie)
 */
/*class CookieForwardingDataSource extends RemoteGraphQLDataSource {
  override willSendRequest({
    request,
    context,
  }: {
    request: any;
    context: any;
  }) {
    // Forward authorization header (existing logic)
    const auth = context.token ?? context.req?.headers?.authorization;
    if (auth) {
      request.http?.headers.set('authorization', auth);
    }

    // Forward cookies from the client to the subgraph
    const cookie = context.req?.headers?.cookie;
    if (cookie) {
      request.http?.headers.set('cookie', cookie);
    }
  }

  override didReceiveResponse({
    response,
    context,
  }: {
    response: any;
    context: any;
  }) {
    // Forward Set-Cookie from the subgraph back to the client
    const setCookie = response.http?.headers?.get('set-cookie');
    if (setCookie && context.res) {
      context.res.setHeader('set-cookie', setCookie);
    }
    return response;
  }
}*/

@Module({
  imports: [
    configModule,
    AppConfigModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.jwtAccessSecret,
        signOptions: { expiresIn: appConfig.jwtAccessExpiresIn },
      }),
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [AppConfigModule],
      inject: [AppConfig, JwtService],
      useFactory: (config: AppConfig, jwtService: JwtService) => ({
        server: {
          cors: true,
          context: ({ req, res }: { req: any; res: Response }) => ({
            req,
            res,
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
          buildService: ({ url }) => {
            if (!url) {
              throw new Error('Subgraph URL is required');
            }
            return new CookieForwardingDataSource(jwtService, { url });
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
