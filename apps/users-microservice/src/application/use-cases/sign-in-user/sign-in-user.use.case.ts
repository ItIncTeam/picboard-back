import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SignInInput } from '../../../graphql/inputs/sign-in.input';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInUserResult } from './sign-in-user.result';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { TokenService } from '../../../domain/services/token.service';

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

    const tokenPayload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(tokenPayload),
      this.tokenService.signRefreshToken(tokenPayload),
    ]);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}
