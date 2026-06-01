import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { PasswordHasher } from '../../../domain/services/password-hasher';

export class SetNewPasswordCommand {
  constructor(
    public readonly code: string,
    public readonly password: string,
  ) {}
}

@CommandHandler(SetNewPasswordCommand)
@Injectable()
export class SetNewPasswordUseCase implements ICommandHandler<SetNewPasswordCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: SetNewPasswordCommand): Promise<void> {
    const user: UserEntity | null =
      await this.usersRepository.findByConfirmationCode(command.code);
    if (!user) {
      throw new BadRequestException('Invalid confirmation code');
    }

    const now: Date = new Date();
    if (!user.confirmationCodeExpDate || user.confirmationCodeExpDate < now) {
      throw new BadRequestException('Confirmation code expired');
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    if (!passwordHash) throw new InternalServerErrorException();

    await this.usersRepository.updatePasswordHash(user.id, passwordHash);
  }
}
