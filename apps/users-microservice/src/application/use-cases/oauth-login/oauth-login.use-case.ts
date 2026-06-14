import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { OAuthAccountsRepository } from '../../../domain/repositories/oauth-account/oauth-accounts.repository';
import { OAuthAccountEntity } from '../../../domain/entities/oauth-account.entity';

export class OAuthLoginCommand {
  constructor(
    public readonly provider: string,
    public readonly providerId: string,
    public readonly email: string,
    public readonly username: string,
    public readonly device?: string,
  ) {}
}

export class OAuthLoginResult {
  userId: string;
  isNewUser: boolean;
  isNewOauth: boolean;
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
    // 1. Ищем существующий OAuth аккаунт
    const existingAccount: OAuthAccountEntity | null =
      await this.oauthAccountsRepository.findByProviderAndProviderId(
        command.provider,
        command.providerId,
      );

    if (existingAccount) {
      return {
        userId: existingAccount.userId,
        isNewUser: false,
        isNewOauth: false,
      };
    }

    // 2. Не найден — проверяем email
    const existingUser = await this.usersRepository.findByEmail(command.email);

    if (existingUser) {
      // Email уже занят — привязываем OAuth к существующему аккаунту
      // Это безопасно, т.к. email прошёл проверку verified через GithubOAuthService
      await this.oauthAccountsRepository.create({
        userId: existingUser.id,
        provider: command.provider,
        providerId: command.providerId,
        username: command.username,
        email: command.email,
      });

      return { userId: existingUser.id, isNewUser: false, isNewOauth: true };
    }

    // 3. Email свободен — создаём нового пользователя
    const newUser = await this.usersRepository.create({
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

    return { userId: newUser.id, isNewUser: true, isNewOauth: true };
  }
}
