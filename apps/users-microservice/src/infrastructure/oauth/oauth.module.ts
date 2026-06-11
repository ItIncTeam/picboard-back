import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from '../../config/app-config.module';
import { GitHubOAuthController } from './github-oauth.controller';
import { GithubOAuthService } from './github-oauth.service';

@Module({
  imports: [AppConfigModule, CqrsModule],
  controllers: [GitHubOAuthController],
  providers: [GithubOAuthService],
})
export class OAuthModule {}
