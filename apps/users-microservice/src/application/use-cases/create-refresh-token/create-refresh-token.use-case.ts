import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TokenService } from '../../../domain/services/token.service';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository';
import { randomUUID } from 'node:crypto';

export class CreateRefreshTokenCommand {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly device?: string,
  ) {}
}

@CommandHandler(CreateRefreshTokenCommand)
@Injectable()
export class CreateRefreshTokenUseCase
  implements ICommandHandler<CreateRefreshTokenCommand, string>
{
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: CreateRefreshTokenCommand): Promise<string> {
    const token = await this.tokenService.signRefreshToken({
      sub: command.userId,
      email: command.email,
      jti: randomUUID(),
    });

    const payload = await this.tokenService.verifyRefreshToken(token);

    await this.refreshTokenRepository.create({
      token,
      userId: command.userId,
      device: command.device,
      expiresAt: new Date(payload.exp * 1000),
    });

    return token;
  }
}
