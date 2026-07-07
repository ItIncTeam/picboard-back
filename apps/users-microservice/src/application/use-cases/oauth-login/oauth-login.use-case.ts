import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { OAuthAccountsRepository } from '../../../domain/repositories/oauth-account/oauth-accounts.repository';
import { OAuthAccountEntity } from '../../../domain/entities/oauth-account.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export class OAuthLoginCommand {
  constructor(
    public readonly provider: string,
    public readonly providerId: string,
    public readonly email: string,
    public readonly username: string,
    public readonly avatarUrl?: string | null,
  ) {}
}

export class OAuthLoginResult {
  userId: string;
}

@CommandHandler(OAuthLoginCommand)
@Injectable()
export class OAuthLoginUseCase implements ICommandHandler<
  OAuthLoginCommand,
  OAuthLoginResult
> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly oauthAccountsRepository: OAuthAccountsRepository,
  ) {}

  async execute(command: OAuthLoginCommand): Promise<OAuthLoginResult> {
    // 1. Look for an existing OAuth account
    const existingAccount: OAuthAccountEntity | null =
      await this.oauthAccountsRepository.findByProviderAndProviderId(
        command.provider,
        command.providerId,
      );

    if (existingAccount) {
      return {
        userId: existingAccount.userId,
      };
    }

    // 2. Not found — check by email
    const existingUser = await this.usersRepository.findByEmail(command.email);

    if (existingUser) {
      // Email already taken — link OAuth to existing account
      // Safe because the email was verified via GithubOAuthService
      await this.oauthAccountsRepository.create({
        userId: existingUser.id,
        provider: command.provider,
        providerId: command.providerId,
        username: command.username,
        email: command.email,
        // avatarUrl: command.avatarUrl, // Todo: add avatarUrl to User schema
      });

      return {
        userId: existingUser.id,
      };
    }

    // 3. Email is free — create a new user
    const newUser: UserEntity = await this.usersRepository.create({
      email: command.email,
      username: command.username,
      passwordHash: null,
      confirmationCode: null,
      confirmationCodeExpDate: null,
      isConfirmed: true,
    });

    await this.oauthAccountsRepository.create({
      userId: newUser.id,
      provider: command.provider,
      providerId: command.providerId,
      username: command.username,
      email: command.email,
    });

    return {
      userId: newUser.id,
    };
  }
}
