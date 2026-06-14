/*import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from '../../config/app-config.module';
import { GitHubOAuthController } from './github-oauth.controller';
import { GithubOAuthService } from './github-oauth.service';
import { OAuthExchangeCodesRepository } from '../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { PrismaOAuthExchangeCodesRepository } from '../prisma/repositories/prisma-oauth-exchange-code/prisma-oauth-exchange-codes.repository';

@Module({
  imports: [AppConfigModule, CqrsModule],
  controllers: [GitHubOAuthController],
  providers: [
    GithubOAuthService,
    {
      provide: OAuthExchangeCodesRepository,
      useClass: PrismaOAuthExchangeCodesRepository,
    },
  ],
  exports: [OAuthExchangeCodesRepository],
})
export class OAuthModule {}*/
