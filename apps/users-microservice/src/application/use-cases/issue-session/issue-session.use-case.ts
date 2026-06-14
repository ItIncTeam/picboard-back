import { Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenService } from '../../../domain/services/token.service';
import { CreateRefreshTokenCommand } from '../create-refresh-token/create-refresh-token.use-case';

export class IssueSessionCommand {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

export type IssueSessionResult = {
  accessToken: string;
  refreshToken: string;
};

@CommandHandler(IssueSessionCommand)
@Injectable()
export class IssueSessionUseCase
  implements ICommandHandler<IssueSessionCommand, IssueSessionResult>
{
  constructor(
    private readonly tokenService: TokenService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: IssueSessionCommand): Promise<IssueSessionResult> {
    const accessToken = await this.tokenService.signAccessToken({
      sub: command.userId,
      email: command.email,
    });

    const refreshToken = await this.commandBus.execute(
      new CreateRefreshTokenCommand(command.userId, command.email),
    );

    return { accessToken, refreshToken };
  }
}
