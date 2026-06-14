import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OAuthExchangeCodesRepository } from '../../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { AppConfig } from '../../../config/app.config';
import { CreateOAuthExchangeCodeInput } from './create-oauth-exchange-code-input';

export class CreateOAuthExchangeCodeCommand {
  constructor(public input: CreateOAuthExchangeCodeInput) {}
}

export class CreateOAuthExchangeCodeResult {
  code: string;
}

@CommandHandler(CreateOAuthExchangeCodeCommand)
@Injectable()
export class CreateOAuthExchangeCodeUseCase
  implements ICommandHandler<CreateOAuthExchangeCodeCommand, CreateOAuthExchangeCodeResult>
{
  constructor(
    private readonly oAuthExchangeCodesRepository: OAuthExchangeCodesRepository,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(
    command: CreateOAuthExchangeCodeCommand,
  ): Promise<CreateOAuthExchangeCodeResult> {
    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(rawCode).digest('hex');

    await this.oAuthExchangeCodesRepository.create({
      codeHash,
      userId: command.input.userId,
      provider: command.input.provider,
      expiresAt: new Date(Date.now() + this.appConfig.oauthCodeExpiresInMs),
      usedAt: null,
    });

    return { code: rawCode };
  }
}
