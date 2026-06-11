import { OAuthExchangeCodeEntity } from '../../entities/aouth-exchange-code.entity';
import { CreateOAuthExchangeCodeData } from './create-oauth-exchange-code-data.type';

export abstract class OAuthExchangeCodesRepository {
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
