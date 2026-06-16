import { CreateRefreshTokenData } from './create-refresh-token-data.type';

export abstract class RefreshTokenRepository {
  abstract create(data: CreateRefreshTokenData): Promise<void>;

  abstract findByToken(token: string): Promise<{
    userId: string;
    expiresAt: Date;
  } | null>;

  abstract deleteByToken(token: string): Promise<void>;

  abstract deleteAllByUserId(userId: string): Promise<void>;
}
