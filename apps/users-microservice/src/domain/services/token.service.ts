export abstract class TokenService {
  abstract signAccessToken(payload: {
    sub: string;
    email: string;
  }): Promise<string>;

  abstract signRefreshToken(payload: {
    sub: string;
    email: string;
    jti: string;
  }): Promise<string>;

  abstract verifyRefreshToken(token: string): Promise<{
    sub: string;
    email: string;
    exp: number;
    jti: string;
  }>;
}
