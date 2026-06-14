import { Injectable } from '@nestjs/common';
import { OAuthAccountsRepository } from '../../domain/repositories/oauth-account/oauth-accounts.repository';
import { OAuthAccountEntity } from '../../domain/entities/oauth-account.entity';
import { CreateOAuthAccountData } from '../../domain/repositories/oauth-account/create-oauth-account-data.type';
import { UsersPrismaService } from './users-prisma.service';

@Injectable()
export class PrismaOAuthAccountsRepository implements OAuthAccountsRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findByProviderAndProviderId(
    provider: string,
    providerId: string,
  ): Promise<OAuthAccountEntity | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: { provider, providerId },
      },
    });

    if (!account) return null;

    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerId: account.providerId,
      username: account.username,
      email: account.email,
    };
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccountEntity> {
    const account = await this.prisma.oAuthAccount.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerId: data.providerId,
        username: data.username ?? null,
        email: data.email ?? null,
      },
    });

    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerId: account.providerId,
      username: account.username,
      email: account.email,
    };
  }
}
