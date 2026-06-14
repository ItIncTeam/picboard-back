import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';

export type GithubUser = {
  id: number;
  login: string;
  email: string;
  isVerified: boolean;
};

@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);

  constructor(private readonly appConfig: AppConfig) {}

  /**
   * Обменивает временный code от GitHub на access_token
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
   * Запрашивает профиль пользователя GitHub
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
      email?: string | null;
    };

    // Всегда запрашиваем список email-ов для проверки verified
    // email из /user может быть null (если скрыт в настройках) и не гарантирует verified
    const verifiedEmail = await this.fetchVerifiedEmail(githubToken);

    if (!verifiedEmail) {
      this.logger.warn(
        `GitHub user ${githubUser.login} has no verified public email`,
      );
      // throw new Error(
      //   'A verified public email is required to sign in with GitHub. ' +
      //     'Please add a public verified email in your GitHub settings: ' +
      //     'https://github.com/settings/emails',
      // );
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
    };
  }

  /**
   * Запрашивает список email-ов и возвращает первый подтверждённый primary email
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
