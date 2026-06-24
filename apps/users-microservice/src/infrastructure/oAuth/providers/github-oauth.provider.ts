import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app.config';
import {
  OAuthProvider,
  OAuthUserProfile,
} from '../../../domain/services/oauth-provider';

@Injectable()
export class GithubOAuthProvider implements OAuthProvider {
  private readonly logger = new Logger(GithubOAuthProvider.name);

  constructor(private readonly appConfig: AppConfig) {}

  getLoginUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appConfig.githubClientId,
      redirect_uri: this.appConfig.githubCallbackUrl,
      state,
      scope: 'read:user user:email',
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.appConfig.githubClientId,
        client_secret: this.appConfig.githubClientSecret,
        code,
        redirect_uri: this.appConfig.githubCallbackUrl,
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!data.access_token) {
      this.logger.warn(`GitHub token exchange failed: ${data.error}`);
      throw new Error(`GitHub token exchange failed: ${data.error}`);
    }

    return data.access_token;
  }

  async getUserProfile(githubToken: string): Promise<OAuthUserProfile> {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const githubUser = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    };

    const verifiedEmail = await this.fetchVerifiedEmail(githubToken);

    if (!verifiedEmail) {
      this.logger.warn(
        `GitHub user ${githubUser.login} has no verified public email`,
      );
      return {
        provider: 'github',
        providerId: String(githubUser.id),
        email: '',
        emailVerified: false,
      };
    }

    return {
      provider: 'github',
      providerId: String(githubUser.id),
      email: verifiedEmail,
      emailVerified: true,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
    };
  }

  private async fetchVerifiedEmail(
    githubToken: string,
  ): Promise<string | null> {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!emailsRes.ok) {
      this.logger.warn(`Failed to fetch GitHub emails: ${emailsRes.status}`);
      return null;
    }

    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const verified = emails.find((e) => e.primary && e.verified);
    return verified?.email ?? null;
  }
}
