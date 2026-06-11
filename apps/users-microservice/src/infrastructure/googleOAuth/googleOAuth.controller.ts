import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { CommandBus } from '@nestjs/cqrs';
import { AppConfig } from '../../config/app.config';
import { CompleteGoogleOAuthCommand } from '../../application/use-cases/complete-google-oAuth/complete-google-oAuth.use.case';
import { GoogleOAuthOutput } from './oauth-models/google-oauth.output';
import { GoogleOAuthLoginOutput } from './oauth-login-models/google-oauth-login.output';
import { CompleteGoogleOAuthLoginCommand } from '../../application/use-cases/complete-google-oAuth-login/complete-google-oAuth-login.use.case';
import { GoogleOAuthInput } from './oauth-models/google-oauth.input';
import { CreateOAuthExchangeCodeCommand } from '../../application/use-cases/create-oauth-exchange-code/create-oauth-exchange-code.use.case';
import { CreateOAuthExchangeCodeOutput } from './create-oauth-exchange-code-models/create-oauth-exchange-code.output';
import { GoogleOAuthLoginInput } from './oauth-login-models/google-oauth-login.input';

const b64url = (input: Buffer) =>
  input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

@Controller('auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('start')
  /*async*/
  start(@Res() res: Response) {
    const state = b64url(randomBytes(32));
    const verifier = b64url(randomBytes(64));
    const challenge = b64url(createHash('sha256').update(verifier).digest());

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/auth/google',
      maxAge: 10 * 60 * 1000,
    });

    res.cookie('oauth_pkce_verifier', verifier, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/auth/google',
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: this.appConfig.googleClientId,
      redirect_uri: this.appConfig.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    return res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    );
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const savedState = req.cookies?.oauth_state;
    const verifier = req.cookies?.oauth_pkce_verifier;

    if (error) {
      throw new BadRequestException(`Google OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new BadRequestException('Missing OAuth callback parameters');
    }

    if (!savedState || state !== savedState) {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (!verifier) {
      throw new BadRequestException('Missing PKCE code verifier');
    }

    const input_1: GoogleOAuthInput = {
      code,
      codeVerifier: verifier,
      ipAddress: req.ip ? req.ip : undefined, //todo undefined?
      userAgent: req.headers['user-agent']
        ? req.headers['user-agent']
        : undefined, //todo undefined?
    };
    const googleOAuthResult: GoogleOAuthOutput = await this.commandBus.execute(
      new CompleteGoogleOAuthCommand(input_1),
    );

    const input_2: GoogleOAuthLoginInput = {
      provider: googleOAuthResult.provider,
      providerId: googleOAuthResult.providerId,
      email: googleOAuthResult.email,
      emailVerified: googleOAuthResult.emailVerified,
      displayName: googleOAuthResult.displayName
        ? googleOAuthResult.displayName
        : undefined, //todo undefined?
      avatarUrl: googleOAuthResult.avatarUrl
        ? googleOAuthResult.avatarUrl
        : undefined, //todo undefined?
      grantedScopes: googleOAuthResult.grantedScopes, //todo undefined? do i need them?
    };
    const loginResult: GoogleOAuthLoginOutput = await this.commandBus.execute(
      new CompleteGoogleOAuthLoginCommand(input_2),
    );
    if (loginResult.usedOAuth) {
      ('Front redirects to sign in with access and refresh tokens');
    }

    const exchangeCode: CreateOAuthExchangeCodeOutput =
      await this.commandBus.execute(
        new CreateOAuthExchangeCodeCommand({
          userId: loginResult.userId,
          provider: loginResult.provider,
        }),
      );

    res.clearCookie('oauth_state', { path: '/auth/google' });
    res.clearCookie('oauth_pkce_verifier', { path: '/auth/google' });

    //todo we return the code to the same url?
    return res.redirect(
      `${this.appConfig.frontendUrl}/auth/callback?code=${encodeURIComponent(exchangeCode.code)}`,
    );
  }
}
