import { OAuthAccountEntity } from '../../entities/oauth-account.entity';
import { CreateOAuthAccountData } from './create-oauth-account-data.type';

export abstract class OAuthAccountsRepository {
  abstract findByProviderAndProviderId(
    provider: string,
    providerId: string,
  ): Promise<OAuthAccountEntity | null>;

  abstract create(data: CreateOAuthAccountData): Promise<OAuthAccountEntity>;
}
