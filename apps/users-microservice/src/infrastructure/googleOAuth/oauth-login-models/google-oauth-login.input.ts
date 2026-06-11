export type GoogleOAuthLoginInput = {
  provider: 'google';
  providerId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  grantedScopes: string[];
};
