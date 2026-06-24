import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from '../../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GitHubOAuthController } from './controllers/github-oauth.controller';
import { OAuthService } from './oauth.service';
import { GithubOAuthProvider } from './providers/github-oauth.provider';
import { OAuthExchangeCodesRepository } from '../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { PrismaOAuthExchangeCodesRepository } from '../prisma/repositories/prisma-oauth-exchange-code/prisma-oauth-exchange-codes.repository';

@Module({
  imports: [AppConfigModule, PrismaModule, CqrsModule],
  controllers: [GitHubOAuthController],
  providers: [
    GithubOAuthProvider,
    OAuthService,
    {
      provide: OAuthExchangeCodesRepository,
      useClass: PrismaOAuthExchangeCodesRepository,
    },
  ],
  exports: [OAuthService, OAuthExchangeCodesRepository],
})
export class OAuthModule {}
