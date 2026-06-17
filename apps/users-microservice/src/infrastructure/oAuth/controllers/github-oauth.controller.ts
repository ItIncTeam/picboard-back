import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../../config/app.config';
import { OAuthService } from '../oauth.service';
import { GithubOAuthProvider } from '../providers/github-oauth.provider';
import type { Request, Response } from 'express';

const STATE_COOKIE = 'oauth_state';

@Controller('api/v1/auth/github')
export class GitHubOAuthController {
  private readonly logger = new Logger(GitHubOAuthController.name);

  constructor(
    private readonly appConfig: AppConfig,
    private readonly oauthService: OAuthService,
    private readonly githubProvider: GithubOAuthProvider,
  ) {}

  @Get('login')
  login(@Res() res: Response): void {
    const state = randomUUID();

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });

    res.redirect(this.githubProvider.getLoginUrl(state));
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const error = req.query.error as string | undefined;
    const code = req.query.code as string | undefined;
    const stateFromQuery = req.query.state as string | undefined;
    const stateFromCookie = req.cookies?.[STATE_COOKIE];

    res.clearCookie(STATE_COOKIE, { path: '/' });

    if (error) {
      this.logger.warn(`GitHub OAuth error from provider: ${error}`);
      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`,
      );
      return;
    }

    if (
      !stateFromQuery ||
      !stateFromCookie ||
      stateFromQuery !== stateFromCookie
    ) {
      this.logger.warn(
        'GitHub OAuth: invalid state parameter — possible CSRF attack',
      );
      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=invalid_state`,
      );
      return;
    }

    if (!code) {
      this.logger.warn('GitHub OAuth callback without code');
      res.redirect(`${this.appConfig.frontendUrl}/auth/callback?error=no_code`);
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(
        this.githubProvider,
        code,
      );

      res.redirect(`${this.appConfig.frontendUrl}${result.redirectUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GitHub OAuth error: ${message}`);
      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=internal`,
      );
    }
  }
}
