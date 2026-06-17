export abstract class OAuthProvider {
  abstract getLoginUrl(state: string): string;
  abstract exchangeCode(code: string, verifier?: string): Promise<string>;
  abstract getUserProfile(token: string): Promise<OAuthUserProfile>;
}

export type OAuthUserProfile = {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
};
