export type CreateOAuthExchangeCodeData = {
  codeHash: string;
  userId: string;
  provider: string;
  expiresAt: Date;
  usedAt: Date | null;
};
