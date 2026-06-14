import { createHash } from 'node:crypto';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuthExchangeCodesRepository } from '../../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { IssueSessionCommand } from '../issue-session/issue-session.use-case';

export class ExchangeOAuthCodeCommand {
  constructor(public readonly rawCode: string) {}
}

export class ExchangeOAuthCodeResult {
  accessToken: string;
  refreshToken: string;
  user: UserEntity;
}

@CommandHandler(ExchangeOAuthCodeCommand)
@Injectable()
export class ExchangeOAuthCodeUseCase implements ICommandHandler<
  ExchangeOAuthCodeCommand,
  ExchangeOAuthCodeResult
> {
  constructor(
    private readonly oAuthExchangeCodesRepository: OAuthExchangeCodesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: ExchangeOAuthCodeCommand,
  ): Promise<ExchangeOAuthCodeResult> {
    const codeHash = createHash('sha256').update(command.rawCode).digest('hex');

    const record =
      await this.oAuthExchangeCodesRepository.findByCodeHash(codeHash);

    if (!record) {
      throw new UnauthorizedException('Invalid exchange code');
    }

    if (record.usedAt) {
      throw new UnauthorizedException('Exchange code already used');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Exchange code expired');
    }

    await this.oAuthExchangeCodesRepository.markAsUsed(record.id, new Date());

    const user = await this.usersRepository.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const session = await this.commandBus.execute(
      new IssueSessionCommand(user.id, user.email),
    );

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user,
    };
  }
}
