import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../domain/services/token.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfig,
  ) {}

  async signAccessToken(payload: {
    sub: string;
    email: string;
  }): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  async signRefreshToken(payload: {
    sub: string;
    email: string;
    jti: string;
  }): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.appConfig.jwtRefreshSecret,
      expiresIn: this.appConfig.jwtRefreshExpiresIn,
    });
  }

  async verifyRefreshToken(token: string): Promise<{
    sub: string;
    email: string;
    exp: number;
    jti: string;
  }> {
    return this.jwtService.verifyAsync(token, {
      secret: this.appConfig.jwtRefreshSecret,
    });
  }
}
