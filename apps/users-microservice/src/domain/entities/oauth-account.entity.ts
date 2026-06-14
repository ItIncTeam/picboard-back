export type OAuthAccountEntity = {
  id: string;
  userId: string;
  provider: string;
  providerId: string;
  username?: string | null;
  email?: string | null;
};
