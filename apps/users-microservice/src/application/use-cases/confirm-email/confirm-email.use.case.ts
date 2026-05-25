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
      throw new BadRequestException();
    }

    if (user.isConfirmed === true) {
      throw new BadRequestException();
    }

    const now = new Date();
    if (user.confirmationCodeExpDate! < now) {
      throw new BadRequestException();
    }

    const result = await this.usersRepository.confirmUserEmail(user.id);

    return result;
  }
}
