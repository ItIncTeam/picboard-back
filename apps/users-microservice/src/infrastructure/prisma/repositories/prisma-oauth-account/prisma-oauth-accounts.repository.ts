import { Injectable } from '@nestjs/common';
import { OAuthAccountsRepository } from '../../../../domain/repositories/oauth-account/oauth-accounts.repository';
import { UsersPrismaService } from '../../users-prisma.service';
import { OAuthAccountEntity } from '../../../../domain/entities/oauth-account.entity';
import {
  oauthAccountEntitySelect,
  toOAuthAccountEntity,
  toOAuthAccountEntityOrNull,
  toPrismaCreateOAuthAccountData,
} from '../../mappers/oauth-account.mapper';
import { CreateOAuthAccountData } from '../../../../domain/repositories/oauth-account/create-oauth-account-data.type';

@Injectable()
export class PrismaOAuthAccountsRepository implements OAuthAccountsRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findByProviderAndProviderId(
    provider: string,
    providerId: string,
  ): Promise<OAuthAccountEntity | null> {
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      select: oauthAccountEntitySelect,
    });

    return toOAuthAccountEntityOrNull(oauthAccount);
  }

  /*async findByUserId(userId: string): Promise<OAuthAccountEntity[]> {
    const oauthAccounts: OAuthAccount[] =
      await this.prisma.oAuthAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: oauthAccountEntitySelect,
      });

    return toOAuthAccountEntityList(oauthAccounts);
  }*/

  async create(data: CreateOAuthAccountData): Promise<OAuthAccountEntity> {
    const oauthAccount = await this.prisma.oAuthAccount.create({
      data: toPrismaCreateOAuthAccountData(data),
      select: oauthAccountEntitySelect,
    });

    return toOAuthAccountEntity(oauthAccount);
  }
}
