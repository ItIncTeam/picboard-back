import { v4 as uuid } from 'uuid';
import { UserEntity } from '../../../domain/entities/user.entity';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { EmailAdapter } from '../../../infrastructure/messaging/email.adapter';
import { AppConfig } from '../../../config/app.config';

export class ResendConfirmationEmailCommand {
  constructor(public email: string) {}
}

@CommandHandler(ResendConfirmationEmailCommand)
@Injectable()
export class ResendConfirmationEmailUseCase implements ICommandHandler<ResendConfirmationEmailCommand> {
  private readonly logger = new Logger(ResendConfirmationEmailUseCase.name);
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailAdapter: EmailAdapter,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(command: ResendConfirmationEmailCommand): Promise<boolean> {
    const user: UserEntity | null = await this.usersRepository.findByEmail(
      command.email,
    );

    if (!user || user.isConfirmed) {
      return true;
    }

    const newCode = uuid();
    const confirmationCodeExpDate = new Date(
      Date.now() + this.appConfig.emailConfirmationExpiresInMs,
    );

    await this.usersRepository.updateConfirmationData(user.id, {
      confirmationCode: newCode,
      confirmationCodeExpDate: confirmationCodeExpDate,
    });

    const link = `https://picboard.space/auth/confirm/registration?code=${newCode}`;
    const subject = 'Confirm your email';
    const message = `<a href="${link}">Confirm email</a>`;

    try {
      await this.emailAdapter.sendEmail(user.email, subject, message);
    } catch (error) {
      this.logger.error('Cannot send confirmation email', error);
      throw new BadRequestException('Failed to send confirmation email');
    }

    return true;
  }
}
