import { Injectable } from '@nestjs/common';
import { UsersPrismaService } from '../../users-prisma.service';
import { OAuthExchangeCodeEntity } from '../../../../domain/entities/aouth-exchange-code.entity';
import {
  oauthExchangeCodeEntitySelect,
  toOAuthExchangeCodeEntity,
  toOAuthExchangeCodeEntityOrNull,
  toPrismaCreateOAuthExchangeCodeData,
} from '../../mappers/oauth-exchange-code.mapper';
import { OAuthExchangeCodesRepository } from '../../../../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { CreateOAuthExchangeCodeData } from '../../../../domain/repositories/oauth-exchange-code/create-oauth-exchange-code-data.type';

@Injectable()
export class PrismaOAuthExchangeCodesRepository implements OAuthExchangeCodesRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findById(id: string): Promise<OAuthExchangeCodeEntity | null> {
    const code: OAuthExchangeCode | null =
      await this.prisma.oAuthExchangeCode.findUnique({
        where: { id },
        select: oauthExchangeCodeEntitySelect,
      });

    return toOAuthExchangeCodeEntityOrNull(code);
  }

  async findByCodeHash(
    codeHash: string,
  ): Promise<OAuthExchangeCodeEntity | null> {
    const code: OAuthExchangeCode | null =
      await this.prisma.oAuthExchangeCode.findUnique({
        where: { codeHash },
        select: oauthExchangeCodeEntitySelect,
      });

    return toOAuthExchangeCodeEntityOrNull(code);
  }

  /*async findActiveByUserId(userId: string): Promise<OAuthExchangeCodeEntity[]> {
    const now = new Date();

    const codes = await this.prisma.oAuthExchangeCode.findMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: oauthExchangeCodeEntitySelect,
    });

    return toOAuthExchangeCodeEntityList(codes);
  }*/

  async create(
    data: CreateOAuthExchangeCodeData,
  ): Promise<OAuthExchangeCodeEntity> {
    const code: OAuthExchangeCode = await this.prisma.oAuthExchangeCode.create({
      data: toPrismaCreateOAuthExchangeCodeData(data),
      select: oauthExchangeCodeEntitySelect,
    });

    return toOAuthExchangeCodeEntity(code);
  }

  async markAsUsed(id: string, usedAt: Date): Promise<OAuthExchangeCodeEntity> {
    const code = await this.prisma.oAuthExchangeCode.update({
      where: { id },
      data: { usedAt },
      select: oauthExchangeCodeEntitySelect,
    });

    return toOAuthExchangeCodeEntity(code);
  }
}
