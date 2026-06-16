import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../../domain/services/token.service';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository';
import { CreateRefreshTokenCommand } from '../create-refresh-token/create-refresh-token.use-case';

export class RotateRefreshTokenCommand {
  constructor(public readonly oldRefreshToken: string) {}
}

export class RotateRefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

@CommandHandler(RotateRefreshTokenCommand)
@Injectable()
export class RotateRefreshTokenUseCase implements ICommandHandler<
  RotateRefreshTokenCommand,
  RotateRefreshTokenResult
> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: RotateRefreshTokenCommand,
  ): Promise<RotateRefreshTokenResult> {
    let payload: { sub: string; email: string };
    try {
      payload = await this.tokenService.verifyRefreshToken(
        command.oldRefreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.refreshTokenRepository.findByToken(
      command.oldRefreshToken,
    );

    if (!stored) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    await this.refreshTokenRepository.deleteByToken(command.oldRefreshToken);

    const accessToken = await this.tokenService.signAccessToken({
      sub: payload.sub,
      email: payload.email,
    });

    const refreshToken = await this.commandBus.execute(
      new CreateRefreshTokenCommand(payload.sub, payload.email),
    );

    return { accessToken, refreshToken };
  }
}
