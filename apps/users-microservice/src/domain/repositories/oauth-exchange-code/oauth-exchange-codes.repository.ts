import { OAuthExchangeCodeEntity } from '../../entities/aouth-exchange-code.entity';
import { CreateOAuthExchangeCodeData } from './create-oauth-exchange-code-data.type';

export abstract class OAuthExchangeCodesRepository {
  // We keep exchange code exp date in .env. look in app config
  //OAUTH_CODE_EXPIRES_IN_MS=60000
  //const expiresAt = new Date(
  //       Date.now() + this.appConfig.oauthCodeExpiresInMs,
  //     ); //1min
  abstract create(
    data: CreateOAuthExchangeCodeData,
  ): Promise<OAuthExchangeCodeEntity>;

  abstract findByCodeHash(
    codeHash: string,
  ): Promise<OAuthExchangeCodeEntity | null>;

  abstract findById(id: string): Promise<OAuthExchangeCodeEntity | null>;

  /*abstract findActiveByUserId(
    userId: string,
  ): Promise<OAuthExchangeCodeEntity[]>;*/

  abstract markAsUsed(
    id: string,
    usedAt: Date,
  ): Promise<OAuthExchangeCodeEntity>;
}
