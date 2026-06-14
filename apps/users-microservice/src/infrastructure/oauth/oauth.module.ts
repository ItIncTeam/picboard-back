import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from '../../config/app-config.module';
import { GitHubOAuthController } from './github-oauth.controller';
import { GithubOAuthService } from './github-oauth.service';
import { InMemoryExchangeOAuthCodeRepository } from './in-memory-exchange-code.repository';
import { OAuthExchangeCodesRepository } from '../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';

@Module({
  imports: [AppConfigModule, CqrsModule],
  controllers: [GitHubOAuthController],
  providers: [
    GithubOAuthService,
    {
      provide: OAuthExchangeCodesRepository,
      useClass: InMemoryExchangeOAuthCodeRepository,
    },
  ],
  exports: [OAuthExchangeCodesRepository],
})
export class OAuthModule {}
