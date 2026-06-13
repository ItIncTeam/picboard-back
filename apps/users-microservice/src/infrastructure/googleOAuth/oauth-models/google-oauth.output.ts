export type GoogleOAuthOutput = {
  provider: 'google';
  providerId: string; // sub
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  /*grantedScopes: string[];
  googleAccessToken: string;
  googleRefreshToken?: string;
  googleIdToken?: string;*/
};
//todo what else can we get from scope?
