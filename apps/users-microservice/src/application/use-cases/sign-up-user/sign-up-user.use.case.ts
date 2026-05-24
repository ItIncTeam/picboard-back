import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SignUpInput } from '../../../graphql/inputs/sign-up.input';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { EmailAdapter } from '../../../infrastructure/messaging/email.adapter';
import { CreateUserData } from '../../../domain/repositories/create-user-data.type';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../../config/app.config';

export class SignUpUserCommand {
  constructor(public input: SignUpInput) {}
}

@CommandHandler(SignUpUserCommand)
@Injectable()
export class SignUpUserUseCase implements ICommandHandler<SignUpUserCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly emailAdapter: EmailAdapter,
    private readonly appConfig: AppConfig,
    /*private readonly usersEventsPublisher: UsersEventsPublisher,*/
  ) {}

  async execute(command: SignUpUserCommand) {
    const existingUserWithUsername: UserEntity | null =
      await this.usersRepository.findByUsername(command.input.username);

    const existingUserWithEmail: UserEntity | null =
      await this.usersRepository.findByEmail(command.input.email);

    if (existingUserWithUsername || existingUserWithEmail) {
      throw new ConflictException() /*EmailAlreadyTakenError(command.input.email)*/;
    }

    const user = await this.createUser(command.input);
    if (!user) throw new InternalServerErrorException();

    const confirmationCode = user.confirmationCode!;

    const isEmailSent = this.sendEmail(confirmationCode, command.input.email);
    if (!isEmailSent) {
      throw new InternalServerErrorException();
    }

    return user;

    /*await this.usersEventsPublisher.userSignedUp({
      userId: user.id,
      email: user.email,
      username: user.username,
    });*/
  }

  private async createUser(input: SignUpInput) {
    const passwordHash = await this.passwordHasher.hash(input.password);
    if (!passwordHash) return null;

    const userData: CreateUserData = {
      email: input.email,
      username: input.username,
      passwordHash: passwordHash,
      confirmationCode: uuid(),
      confirmationCodeExpDate: new Date(
        Date.now() + this.appConfig.emailConfirmationExpiresInMs,
      ), // an hour in .env.local now
      isConfirmed: false,
    };

    const user: UserEntity = await this.usersRepository.create(userData);
    if (!user) return null;

    return user;
  }

  private sendEmail(confirmationCode: string, email: string): boolean {
    try {
      const msg = `<a href="https://somesite.com/confirm-email?code=${confirmationCode}"> Link</a>`;
      const subject = 'Yo!';

      this.emailAdapter.sendEmail(email, subject, msg);
    } catch (error) {
      console.error(error, 'Cannot send an email with confirmation code');
      return false;
    }

    return true;
  }
}
