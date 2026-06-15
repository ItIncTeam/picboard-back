import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';

export type GithubUser = {
  id: number;
  login: string;
  email: string;
  isVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
};

@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);

  constructor(private readonly appConfig: AppConfig) {}

  /**
   * Exchanges a temporary code from GitHub for an access_token
   */
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

  /**
   * Fetches the GitHub user profile
   */
  async getUserProfile(githubToken: string): Promise<GithubUser> {
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

    // Always fetch the emails list to check for verified status
    // Email from /user may be null (if hidden in settings) and doesn't guarantee verified
    const verifiedEmail = await this.fetchVerifiedEmail(githubToken);

    if (!verifiedEmail) {
      this.logger.warn(
        `GitHub user ${githubUser.login} has no verified public email`,
      );
      return {
        id: githubUser.id,
        login: githubUser.login,
        email: githubUser.email ? githubUser.email : 'verified_email_required',
        isVerified: false,
      };
    }

    return {
      id: githubUser.id,
      login: githubUser.login,
      email: verifiedEmail,
      isVerified: true,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
    };
  }

  /**
   * Fetches the user's email list and returns the first verified primary email
   * GitHub API: https://docs.github.com/en/rest/users/emails
   */
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

    // Берём только primary + verified email
    const verified = emails.find((e) => e.primary && e.verified);
    return verified?.email ?? null;
  }
}
