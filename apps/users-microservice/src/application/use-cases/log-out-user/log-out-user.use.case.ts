import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository';

export class LogOutUserCommand {
  constructor(public refreshToken: string) {}
}

@CommandHandler(LogOutUserCommand)
@Injectable()
export class LogOutUserUseCase implements ICommandHandler<LogOutUserCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}
  async execute(command: LogOutUserCommand): Promise<string> {
    await this.refreshTokenRepository.deleteByToken(command.refreshToken);
    return 'Logged out';
  }
}
