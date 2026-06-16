import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { CreateOAuthExchangeCodeInput } from '../../../infrastructure/oAuth/create-oauth-exchange-code-models/create-oauth-exchange-code.input';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateOAuthExchangeCodeOutput } from '../../../infrastructure/oAuth/create-oauth-exchange-code-models/create-oauth-exchange-code.output';
import { OAuthExchangeCodesRepository } from '../../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { AppConfig } from '../../../config/app.config';

export class CreateOAuthExchangeCodeCommand {
  constructor(public input: CreateOAuthExchangeCodeInput) {}
}

@CommandHandler(CreateOAuthExchangeCodeCommand)
@Injectable()
export class CreateOAuthExchangeCodeUseCase implements ICommandHandler<CreateOAuthExchangeCodeCommand> {
  constructor(
    private readonly oAuthExchangeCodesRepository: OAuthExchangeCodesRepository,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(
    command: CreateOAuthExchangeCodeCommand,
  ): Promise<CreateOAuthExchangeCodeOutput> {
    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = new Date(
      Date.now() + this.appConfig.oauthCodeExpiresInMs,
    ); //1min

    await this.oAuthExchangeCodesRepository.create({
      codeHash,
      userId: command.input.userId,
      provider: command.input.provider,
      expiresAt,
      usedAt: null,
    });

    return {
      code: rawCode,
    };
  }
}
