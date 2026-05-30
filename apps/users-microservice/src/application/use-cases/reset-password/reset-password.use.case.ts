import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { EmailAdapter } from '../../../infrastructure/messaging/email.adapter';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../../config/app.config';

export class ResetPasswordCommand {
  constructor(public email: string) {}
}

@CommandHandler(ResetPasswordCommand)
@Injectable()
export class ResetPasswordUseCase implements ICommandHandler<ResetPasswordCommand> {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailAdapter: EmailAdapter,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const user: UserEntity | null = await this.usersRepository.findByEmail(
      command.email,
    );

    if (!user) {
      return;
    }

    const recoveryCode = uuid();
    const confirmationCodeExpDate = new Date(
      Date.now() + this.appConfig.emailConfirmationExpiresInMs,
    );

    await this.usersRepository.updateConfirmationData(user.id, {
      confirmationCode: recoveryCode,
      confirmationCodeExpDate: confirmationCodeExpDate,
    });

    try {
      await this.emailAdapter.sendEmail(
        command.email,
        'Password recovery',
        this.buildRecoveryMessage(recoveryCode),
      );
    } catch (error) {
      this.logger.error('Cannot send password recovery email', error);
      throw error;
    }
  }

  private buildRecoveryMessage(recoveryCode: string): string {
    return `
      <a href="https://somesite.com/password-recovery?recoveryCode=${recoveryCode}">
        Reset password
      </a>
    `;
  }
}
