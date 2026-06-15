import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../../../config/app.config';
import { GoogleOAuthOutput } from '../../../infrastructure/googleOAuth/oauth-models/google-oauth.output';
import { GoogleOAuthInput } from '../../../infrastructure/googleOAuth/oauth-models/google-oauth.input';

export class CompleteGoogleOAuthCommand {
  constructor(public input: GoogleOAuthInput) {}
}

@CommandHandler(CompleteGoogleOAuthCommand)
@Injectable()
export class CompleteGoogleOAuthUseCase implements ICommandHandler<CompleteGoogleOAuthCommand> {
  constructor(private readonly appConfig: AppConfig) {}

  async execute(
    command: CompleteGoogleOAuthCommand,
  ): Promise<GoogleOAuthOutput> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.appConfig.googleClientId,
        client_secret: this.appConfig.googleClientSecret,
        code: command.input.code,
        code_verifier: command.input.codeVerifier,
        redirect_uri: this.appConfig.googleCallbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new UnauthorizedException(
        `Google token exchange failed: ${errorBody}`,
      );
    }

    type GoogleTokenResponse = {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
      token_type: string;
      id_token?: string;
    };
    const tokens: GoogleTokenResponse =
      (await tokenResponse.json()) as GoogleTokenResponse;

    const userInfoResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      const errorBody = await userInfoResponse.text();
      throw new UnauthorizedException(
        `Unable to fetch Google profile: ${errorBody}`,
      );
    }

    type GoogleUserInfo = {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      given_name?: string;
      family_name?: string;
      /*middle_name?: string;
      nickname?: string;*/
      picture?: string;
      /*profile?: string;
      website?: string;*/
      /*gender?: string;
      birthdate?: string;
      zoneinfo?: string;
      locale?: string;
      updated_at?: string;*/
    };
    const profile: GoogleUserInfo =
      (await userInfoResponse.json()) as GoogleUserInfo;

    if (!profile.email || !profile.email_verified) {
      return {
        provider: 'google',
        providerId: profile.sub,
        ...(profile.email
          ? { email: profile.email }
          : { email: 'verified_email_required' }),
        emailVerified: false,
      };
    }
    //todo front has to ask to go to local sign up

    return {
      provider: 'google',
      providerId: profile.sub,
      email: profile.email,
      emailVerified: true,
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.given_name ? { givenName: profile.given_name } : {}),
      ...(profile.family_name ? { familyName: profile.family_name } : {}),
      ...(profile.picture ? { avatarUrl: profile.picture } : {}),
      /*grantedScopes: tokens.scope ? tokens.scope.split(' ') : [],
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleIdToken: tokens.id_token,*/
    };
  }
}
