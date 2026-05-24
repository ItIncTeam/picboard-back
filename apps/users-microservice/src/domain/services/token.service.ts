export abstract class TokenService {
  abstract signAccessToken(payload: {
    sub: string;
    email: string;
  }): Promise<string>;

  abstract signRefreshToken(payload: {
    sub: string;
    email: string;
  }): Promise<string>;
}
