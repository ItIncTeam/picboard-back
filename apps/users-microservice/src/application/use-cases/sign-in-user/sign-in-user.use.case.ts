import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { SignInInput } from '../../../graphql/inputs/sign-in.input';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInUserResult } from './sign-in-user.result';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { TokenService } from '../../../domain/services/token.service';
import { CreateRefreshTokenCommand } from '../create-refresh-token/create-refresh-token.use-case';

export class SignInUserCommand {
  constructor(public input: SignInInput) {}
}

@CommandHandler(SignInUserCommand)
@Injectable()
export class SignInUserUseCase implements ICommandHandler<SignInUserCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: SignInUserCommand): Promise<SignInUserResult> {
    const user = await this.usersRepository.findByEmail(command.input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isConfirmed) {
      throw new UnauthorizedException('Email is not confirmed');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Account uses OAuth. Please sign in with a provider.',
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      command.input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = await this.commandBus.execute(
      new CreateRefreshTokenCommand(user.id, user.email),
    );

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}
