import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { OAuthAccountsRepository } from '../../../domain/repositories/oauth-account/oauth-accounts.repository';
import { UserEntity } from '../../../domain/entities/user.entity';

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
  user: UserEntity;
  isNewUser: boolean;
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
    const existingAccount =
      await this.oauthAccountsRepository.findByProviderAndProviderId(
        command.provider,
        command.providerId,
      );

    if (existingAccount) {
      // Найден — логинимся
      const user = await this.usersRepository.findById(existingAccount.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return { user, isNewUser: false };
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

      return { user: existingUser, isNewUser: false };
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

    return { user: newUser, isNewUser: true };
  }
}
