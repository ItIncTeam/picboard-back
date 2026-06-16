import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OAuthExchangeCodeEntity } from '../../../domain/entities/aouth-exchange-code.entity';
import { OAuthExchangeCodesRepository } from '../../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { ExchangeOAuthCodeResult } from './exchange-oauth-code.result';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { IssueSessionCommand } from '../issue-session/issue-session.use.case';

export class OAuthExchangeCodeCommand {
  constructor(
    public code: string,
    public ip?: string,
    public userAgent?: string,
  ) {}
}

@CommandHandler(OAuthExchangeCodeCommand)
@Injectable()
export class OAuthExchangeCodeUseCase implements ICommandHandler<OAuthExchangeCodeCommand> {
  constructor(
    private readonly oAuthExchangeCodesRepository: OAuthExchangeCodesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: OAuthExchangeCodeCommand,
  ): Promise<ExchangeOAuthCodeResult> {
    const codeHash = createHash('sha256').update(command.code).digest('hex');

    const record: OAuthExchangeCodeEntity | null =
      await this.oAuthExchangeCodesRepository.findByCodeHash(codeHash);

    if (!record) {
      throw new UnauthorizedException('Invalid exchange code');
    }

    if (record.usedAt) {
      throw new UnauthorizedException('Exchange code already used');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Exchange code expired');
    }

    const user: UserEntity | null = await this.usersRepository.findById(
      record.userId,
    );
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.oAuthExchangeCodesRepository.markAsUsed(record.id, new Date());

    const session = await this.commandBus.execute(
      new IssueSessionCommand(
        record.userId,
        user.email,
        /*ip: command.ip,*/
        /*userAgent: command.userAgent,*/
      ),
    );

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: user,
    };
  }
}
