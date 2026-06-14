export type GoogleOAuthLoginInput = {
  provider: 'google';
  providerId: string;
  email: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
};
