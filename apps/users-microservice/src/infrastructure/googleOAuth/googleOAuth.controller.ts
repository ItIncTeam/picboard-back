import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { CommandBus } from '@nestjs/cqrs';
import { AppConfig } from '../../config/app.config';
import { CompleteGoogleOAuthCommand } from '../../application/use-cases/complete-google-oAuth/complete-google-oAuth.use.case';
import { GoogleOAuthOutput } from './oauth-models/google-oauth.output';
import { GoogleOAuthLoginOutput } from './oauth-login-models/google-oauth-login.output';
import { CompleteGoogleOAuthLoginCommand } from '../../application/use-cases/complete-google-oAuth-login/complete-google-oAuth-login.use.case';
import { CreateOAuthExchangeCodeCommand } from '../../application/use-cases/create-oauth-exchange-code/create-oauth-exchange-code.use.case';
import { CreateOAuthExchangeCodeOutput } from '../oAuth/create-oauth-exchange-code-models/create-oauth-exchange-code.output';
import { GoogleOAuthLoginInput } from './oauth-login-models/google-oauth-login.input';

// this takes a Buffer, encodes it to normal Base64, then converts it to Base64URL. The result is safe to place in query params, cookies, and headers without extra escaping
const b64url = (input: Buffer) =>
  input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

@Controller('api/v1/auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('start')
  async start(@Res() res: Response) {
    const state = b64url(randomBytes(32));
    const verifier = b64url(randomBytes(64));
    const challenge = b64url(createHash('sha256').update(verifier).digest());

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });

    res.cookie('oauth_pkce_verifier', verifier, {
      httpOnly: true,
      secure: this.appConfig.isProduction,
      sameSite: 'lax',
      path: '/',
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
      /*access_type: 'offline', //if Google refresh token needs to be stored...
      prompt: 'consent', //...and consent needs to be specifically shown again by Google to reissue a refresh token*/
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
    /*@Query('error_description') errorDescription?: string,*/
  ) {
    const savedState = req.cookies?.oauth_state;
    const verifier = req.cookies?.oauth_pkce_verifier;

    if (error) {
      /*throw new BadRequestException(`Google OAuth error: ${error}`);*/
      res.clearCookie('oauth_state', { path: '/' });
      res.clearCookie('oauth_pkce_verifier', { path: '/' });

      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code) {
      /*throw new BadRequestException('Missing OAuth callback parameters');*/
      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=no_code}`,
      );
    }

    if (!state || !savedState || state !== savedState) {
      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=invalid_state}`,
      );
      /*throw new BadRequestException('Invalid OAuth state');*/
    }

    if (!verifier) {
      /*throw new BadRequestException('Missing PKCE code verifier');*/
      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=no_pkce_verifier}`,
      );
    }

    /* try {*/
    const googleOAuthResult: GoogleOAuthOutput = await this.commandBus.execute(
      new CompleteGoogleOAuthCommand({
        code,
        codeVerifier: verifier,
      }),
    );
    if (!googleOAuthResult.emailVerified) {
      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=unverified_email`,
      );
    } //todo front asks to do a local sign up

    const payload: GoogleOAuthLoginInput = {
      provider: googleOAuthResult.provider,
      providerId: googleOAuthResult.providerId,
      email: googleOAuthResult.email,
      ...(googleOAuthResult.name ? { name: googleOAuthResult.name } : {}),
      ...(googleOAuthResult.givenName
        ? { givenName: googleOAuthResult.givenName }
        : {}),
      ...(googleOAuthResult.familyName
        ? { familyName: googleOAuthResult.familyName }
        : {}),
      ...(googleOAuthResult.avatarUrl
        ? { avatarUrl: googleOAuthResult.avatarUrl }
        : {}),
    };
    const loginResult: GoogleOAuthLoginOutput = await this.commandBus.execute(
      new CompleteGoogleOAuthLoginCommand(payload),
    );
    /*if (loginResult.status === 'signed_in_existing_oauth') {
      return res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=oauth_exists`,
      );
    } //todo: redirect logic: FRONTS REDIRECT TO SIGN IN AND USER IS LOGGED IN WITH ACCESS AND REFRESH TOKENS*/

    const exchangeCode: CreateOAuthExchangeCodeOutput =
      await this.commandBus.execute(
        new CreateOAuthExchangeCodeCommand({
          userId: loginResult.userId,
          provider: loginResult.provider,
        }),
      );

    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('oauth_pkce_verifier', { path: '/' });

    return res.redirect(
      `${this.appConfig.frontendUrl}/auth/callback?code=${encodeURIComponent(exchangeCode.code)}`,
    );
    /*} catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      /!*this.logger.error(GitHub OAuth error: ${message});*!/

      const errorType = message.includes('verified')
        ? 'email_not_verified'
        : message.includes('No code')
          ? 'no_code'
          : message.includes('token exchange')
            ? 'token_exchange'
            : 'internal';

      res.redirect(
        `${this.appConfig.frontendUrl}/auth/callback?error=${errorType}`,
      );
    }*/
  }
}
