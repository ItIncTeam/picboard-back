import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../config/app.config';
import { GithubOAuthService } from './github-oauth.service';
import { CommandBus } from '@nestjs/cqrs';
import { OAuthLoginCommand } from '../../application/use-cases/oauth-login/oauth-login.use-case';
import type { Request, Response } from 'express';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 минут

@Controller('api/v1/auth/github')
export class GitHubOAuthController {
  private readonly logger = new Logger(GitHubOAuthController.name);

  constructor(
    private readonly appConfig: AppConfig,
    private readonly githubOAuthService: GithubOAuthService,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('login')
  login(@Res() res: Response): void {
    const state = randomUUID();

    // Сохраняем state в httpOnly cookie — браузер пришлёт его обратно на callback
    // Безопасность: httpOnly не даёт JS прочитать, sameSite не даёт подделать с другого сайта
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth/github/callback',
      maxAge: 10 * 60 * 1000,
    });

    const url =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(this.appConfig.githubClientId)}` +
      `&redirect_uri=${encodeURIComponent(this.appConfig.githubCallbackUrl)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent('read:user user:email')}`;

    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const code = req.query.code as string | undefined;
    const stateFromQuery = req.query.state as string | undefined;
    const stateFromCookie = req.cookies?.[STATE_COOKIE];

    // Проверяем state — защита от CSRF
    res.clearCookie(STATE_COOKIE, { path: '/api/v1/auth/github/callback' });

    if (
      !stateFromQuery ||
      !stateFromCookie ||
      stateFromQuery !== stateFromCookie
    ) {
      this.logger.warn(
        'GitHub OAuth: invalid state parameter — possible CSRF attack',
      );
      res.redirect(
        `${this.appConfig.oauthSuccessRedirectUrl}?error=invalid_state`,
      ); // todo: отдать фронтам
      return;
    }

    if (!code) {
      this.logger.warn('GitHub OAuth callback without code');
      res.redirect(`${this.appConfig.oauthSuccessRedirectUrl}?error=no_code`); // todo: отдать фронтам
      return;
    }

    try {
      // 1. Обмен code на access_token → запрос данных пользователя
      const githubToken = await this.githubOAuthService.exchangeCode(code);
      const githubUser =
        await this.githubOAuthService.getUserProfile(githubToken);

      // 2. Логин или регистрация
      const device = req.headers['user-agent'] ?? 'unknown';
      const result = await this.commandBus.execute(
        new OAuthLoginCommand(
          'github',
          String(githubUser.id),
          githubUser.email,
          githubUser.login,
          device,
        ),
      );

      // 3. httpOnly cookie с refreshToken
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: this.appConfig.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // 4. Редирект на фронт без токена в URL (токен в httpOnly cookie)
      // Фронт должен вызвать mutation { refreshToken { accessToken } }
      res.redirect(
        `${this.appConfig.oauthSuccessRedirectUrl}?oauth=github&is_new=${result.isNewUser}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GitHub OAuth error: ${message}`);

      // Пробуем определить тип ошибки для редиректа
      const errorType = message.includes('verified')
        ? 'email_not_verified'
        : message.includes('No code')
          ? 'no_code'
          : message.includes('token exchange')
            ? 'token_exchange'
            : 'internal';

      res.redirect(
        `${this.appConfig.oauthSuccessRedirectUrl}?error=${errorType}`,
      );
    }
  }
}
