export type GoogleOAuthOutput = {
  provider: 'google';
  providerId: string; // sub
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
};
