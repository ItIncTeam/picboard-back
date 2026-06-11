import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { TokenService } from '../../../domain/services/token.service';
import { CreateRefreshTokenCommand } from '../create-refresh-token/create-refresh-token.use-case';

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
  accessToken: string;
  refreshToken: string;
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
    private readonly tokenService: TokenService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: OAuthLoginCommand): Promise<OAuthLoginResult> {
    // 1. Ищем существующий OAuth аккаунт
    const existingAccount =
      await this.usersRepository.findOAuthAccountByProvider(
        command.provider,
        command.providerId,
      );

    if (existingAccount) {
      // Найден — логинимся
      const user = await this.usersRepository.findById(existingAccount.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const accessToken = await this.tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
      });

      const refreshToken = await this.commandBus.execute(
        new CreateRefreshTokenCommand(user.id, user.email, command.device),
      );

      return { user, accessToken, refreshToken, isNewUser: false };
    }

    // 2. Не найден — проверяем email
    const existingUser = await this.usersRepository.findByEmail(command.email);

    if (existingUser) {
      // Email уже занят — привязываем OAuth к существующему аккаунту
      // Это безопасно, т.к. email прошёл проверку verified через GithubOAuthService
      await this.usersRepository.createOAuthAccount({
        userId: existingUser.id,
        provider: command.provider,
        providerId: command.providerId,
        username: command.username,
        email: command.email,
      });

      const accessToken = await this.tokenService.signAccessToken({
        sub: existingUser.id,
        email: existingUser.email,
      });

      const refreshToken = await this.commandBus.execute(
        new CreateRefreshTokenCommand(
          existingUser.id,
          existingUser.email,
          command.device,
        ),
      );

      return { user: existingUser, accessToken, refreshToken, isNewUser: false };
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

    await this.usersRepository.createOAuthAccount({
      userId: newUser.id,
      provider: command.provider,
      providerId: command.providerId,
      username: command.username,
      email: command.email,
    });

    const accessToken = await this.tokenService.signAccessToken({
      sub: newUser.id,
      email: newUser.email,
    });

    const refreshToken = await this.commandBus.execute(
      new CreateRefreshTokenCommand(newUser.id, newUser.email, command.device),
    );

    return { user: newUser, accessToken, refreshToken, isNewUser: true };
  }
}
