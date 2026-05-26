export type CreateRefreshTokenData = {
  token: string;
  userId: string;
  device?: string;
  expiresAt: Date;
};
