import { CommandBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '../../domain/services/oauth-provider';
import { OAuthLoginCommand } from '../../application/use-cases/oauth-login/oauth-login.use-case';
import { CreateOAuthExchangeCodeCommand } from '../../application/use-cases/create-oauth-exchange-code/create-oauth-exchange-code.use.case';

@Injectable()
export class OAuthService {
  constructor(private readonly commandBus: CommandBus) {}

  async handleCallback(
    provider: OAuthProvider,
    code: string,
  ): Promise<{ redirectUrl: string }> {
    const token = await provider.exchangeCode(code);
    const profile = await provider.getUserProfile(token);

    if (!profile.emailVerified) {
      return { redirectUrl: '/auth/callback?error=unverified_email' };
    }

    const loginResult = await this.commandBus.execute(
      new OAuthLoginCommand(
        profile.provider,
        profile.providerId,
        profile.email,
        profile.name ?? profile.email.split('@')[0],
        profile.avatarUrl,
      ),
    );

    const exchangeCode = await this.commandBus.execute(
      new CreateOAuthExchangeCodeCommand({
        userId: loginResult.userId,
        provider: profile.provider,
      }),
    );

    return {
      redirectUrl: `/auth/callback?code=${encodeURIComponent(exchangeCode.code)}`,
    };
  }
}
