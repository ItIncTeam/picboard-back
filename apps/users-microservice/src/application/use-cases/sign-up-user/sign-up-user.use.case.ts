import {
  BadRequestException,
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
import { UserConsentEntity } from '../../../domain/entities/user-consent.entity';
import { LegalDocumentType } from '../../../domain/enums/legal-document-type.enum';
import { ConsentAction } from '../../../domain/enums/consent-action.enum';
import { ConsentRepository } from '../../../domain/repositories/consent/consent.repository';
import { CreateUserConsentData } from '../../../domain/repositories/consent/create-user-consent-data.type';

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
    private readonly consentRepository: ConsentRepository,
  ) {}

  async execute(command: SignUpUserCommand): Promise<UserEntity> {
    if (!command.input.acceptTerms) {
      throw new BadRequestException('Terms must be accepted');
    }

    if (!command.input.acceptPrivacy) {
      throw new BadRequestException('Privacy Policy must be accepted');
    }

    const existingUserWithUsername: UserEntity | null =
      await this.usersRepository.findByUsername(command.input.username);

    if (existingUserWithUsername) {
      throw new ConflictException('Username is already taken');
    }

    const existingUserWithEmail: UserEntity | null =
      await this.usersRepository.findByEmail(command.input.email);

    if (existingUserWithEmail) {
      throw new ConflictException('Email is already taken');
    }

    const user: UserEntity | null = await this.createUser(
      command.input.email,
      command.input.username,
      command.input.password,
    );
    if (!user) throw new InternalServerErrorException();

    const termsData: CreateUserConsentData = {
      userId: user.id,
      type: LegalDocumentType.TERMS,
      action: ConsentAction.ACCEPTED,
    };
    const termsConsent: UserConsentEntity =
      await this.consentRepository.createConsent(termsData);
    const privacyData: CreateUserConsentData = {
      userId: user.id,
      type: LegalDocumentType.PRIVACY,
      action: ConsentAction.ACCEPTED,
    };
    const privacyConsent: UserConsentEntity =
      await this.consentRepository.createConsent(privacyData);

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
      const msg = `<a href="https://picboard.space/auth/confirm/registration?code=${confirmationCode}"> Link</a>`;
      const subject = 'Yo!';

      await this.emailAdapter.sendEmail(email, subject, msg);
    } catch (error) {
      console.error(error, 'Cannot send an email with confirmation code');
      return false;
    }

    return true;
  }
}
