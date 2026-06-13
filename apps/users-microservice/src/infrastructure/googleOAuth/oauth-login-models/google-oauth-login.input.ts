export type GoogleOAuthLoginInput = {
  provider: 'google';
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
};
