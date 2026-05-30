import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { EmailAdapter } from '../../../infrastructure/messaging/email.adapter';
import { CreateUserData } from '../../../domain/repositories/create-user-data.type';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../../config/app.config';
import { SignUpInput } from '../../../graphql/inputs/sign-up.input';

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
  ) {}

  async execute(command: SignUpUserCommand): Promise<UserEntity> {
    const existingUserWithUsername: UserEntity | null =
      await this.usersRepository.findByUsername(command.input.username);

    const existingUserWithEmail: UserEntity | null =
      await this.usersRepository.findByEmail(command.input.email);

    if (existingUserWithUsername || existingUserWithEmail) {
      throw new ConflictException();
    }

    const user = await this.createUser(
      command.input.email,
      command.input.username,
      command.input.password,
    );
    if (!user) throw new InternalServerErrorException();

    const confirmationCode = user.confirmationCode!;

    const isEmailSent = await this.sendEmail(
      confirmationCode,
      command.input.email,
    );
    if (!isEmailSent) {
      throw new InternalServerErrorException();
    }

    return user;
  }

  private async createUser(
    email: string,
    username: string,
    password: string,
  ): Promise<UserEntity | null> {
    const passwordHash = await this.passwordHasher.hash(password);
    if (!passwordHash) return null;

    const userData: CreateUserData = {
      email: email,
      username: username,
      passwordHash: passwordHash,
      confirmationCode: uuid(),
      confirmationCodeExpDate: new Date(
        Date.now() + this.appConfig.emailConfirmationExpiresInMs,
      ),
      isConfirmed: false,
    };

    const user: UserEntity = await this.usersRepository.create(userData);
    if (!user) return null;

    return user;
  }

  private async sendEmail(
    confirmationCode: string,
    email: string,
  ): Promise<boolean> {
    try {
      const msg = `<a href="https://somesite.com/confirm-email?code=${confirmationCode}"> Link</a>`;
      const subject = 'Yo!';

      await this.emailAdapter.sendEmail(email, subject, msg);
    } catch (error) {
      console.error(error, 'Cannot send an email with confirmation code');
      return false;
    }

    return true;
  }
}
