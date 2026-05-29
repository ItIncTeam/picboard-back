import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { EmailConfirmationInput } from '../../../graphql/inputs/email-confirmation.input';

export class ConfirmEmailCommand {
  constructor(public input: EmailConfirmationInput) {}
}

@CommandHandler(ConfirmEmailCommand)
@Injectable()
export class ConfirmEmailUseCase implements ICommandHandler<ConfirmEmailCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(command: ConfirmEmailCommand) {
    const user: UserEntity | null =
      await this.usersRepository.findByConfirmationCode(command.input.code);
    if (!user) {
      throw new BadRequestException('Invalid confirmation code');
    }

    if (user.isConfirmed) {
      throw new BadRequestException('Email already confirmed');
    }

    const now = new Date();
    if (!user.confirmationCodeExpDate || user.confirmationCodeExpDate < now) {
      throw new BadRequestException('Confirmation code expired');
    }

    return this.usersRepository.confirmUserEmail(user.id);
  }
}
