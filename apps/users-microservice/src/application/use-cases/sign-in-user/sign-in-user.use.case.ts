import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { SignInInput } from '../../../graphql/inputs/sign-in.input';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInUserResult } from './sign-in-user.result';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { IssueSessionCommand } from '../issue-session/issue-session.use.case';

export class SignInUserCommand {
  constructor(public input: SignInInput) {}
}

@CommandHandler(SignInUserCommand)
@Injectable()
export class SignInUserUseCase implements ICommandHandler<SignInUserCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
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

    const session = await this.commandBus.execute(
      new IssueSessionCommand(user.id, user.email),
    );
    return {
      user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
