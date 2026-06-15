import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../config/app.config';
import { GithubOAuthService } from './github-oauth.service';
import { CommandBus } from '@nestjs/cqrs';
import {
  OAuthLoginCommand,
  OAuthLoginResult,
} from '../../application/use-cases/oauth-login/oauth-login.use-case';
import type { Request, Response } from 'express';
import { CreateOAuthExchangeCodeCommand } from '../../application/use-cases/create-oauth-exchange-code/create-oauth-exchange-code.use.case';

const STATE_COOKIE = 'oauth_state';

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

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/',
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

    // Проверяем state — защита от CSRF
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
      const githubToken = await this.githubOAuthService.exchangeCode(code);
      const githubUser =
        await this.githubOAuthService.getUserProfile(githubToken);

      //todo уже есть проверка в сервисе
      if (!githubUser.isVerified || !githubUser.email) {
        return res.redirect(
          `${this.appConfig.frontendUrl}/auth/callback?error=unverified_email`,
        );
      }
      // front has to ask to go to local sign up

      // 2. Логин или регистрация
      // const device = req.headers['user-agent'] ?? 'unknown';
      const result: OAuthLoginResult = await this.commandBus.execute(
        new OAuthLoginCommand(
          'github', // todo: прописать константы для github google
          String(githubUser.id),
          githubUser.email,
          githubUser.login,
          githubUser.avatarUrl ?? '',
        ),
      );

      // 3. Генерируем одноразовый exchangeCode, сохраняем хэш
      const exchangeCode = await this.commandBus.execute(
        new CreateOAuthExchangeCodeCommand({
          userId: result.userId,
          provider: 'github',
        }),
      );

      // 4. Редирект на фронт с exchangeCode
      // Фронт вызывает mutation { exchangeOAuthCode(code: "...") } → получает accessToken
      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?code=${encodeURIComponent(exchangeCode.code)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GitHub OAuth error: ${message}`);
      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=internal`,
      );
    }
  }
}
