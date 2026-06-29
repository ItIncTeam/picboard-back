//configModule from './dynamic-config.module' HAS TO BE IMPORTED ON TOP OF EVERYTHING!
import { configModule } from './dynamic-config.module';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';
import { AppConfig } from './config/app.config';
import { AppConfigModule } from './config/app-config.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PicboardDataSource } from './auth/picboard-data-source';

//This gateway module keeps JWT verification centralized and sends a distinct gateway secret to each subgraph.
@Module({
  imports: [
    configModule,
    AppConfigModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.jwtAccessSecret,
      }),
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [AppConfigModule, JwtModule],
      inject: [AppConfig, JwtService],
      useFactory: (appConfig: AppConfig, jwtService: JwtService) => ({
        server: {
          path: '/api/v1',
          cors: {
            origin: ['https://picboard.space', 'http://localhost:3000'],
            credentials: true,
            methods: ['POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
          },
          context: ({ req, res }: { req: any; res: any }) => ({ req, res }),
        },
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: [
              { name: 'users', url: appConfig.usersGqlUrl },
              { name: 'posts', url: appConfig.postsGqlUrl },
              { name: 'files', url: appConfig.filesGqlUrl },
            ],
          }),
          buildService: ({ name, url }) => {
            if (!url) {
              throw new Error('Subgraph URL is required');
            }

            const secretMap: Record<string, string> = {
              users: appConfig.usersSubgraphSecret,
              posts: appConfig.postsSubgraphSecret,
              files: appConfig.filesSubgraphSecret,
            };

            const secret = secretMap[name];
            if (!secret) {
              throw new Error(`Missing subgraph secret for ${name}`);
            }

            return new PicboardDataSource(jwtService, secret, { url });
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
