import { OAuthExchangeCodeEntity } from '../../../domain/entities/aouth-exchange-code.entity';
import { CreateOAuthExchangeCodeData } from '../../../domain/repositories/oauth-exchange-code/create-oauth-exchange-code-data.type';

export const oauthExchangeCodeEntitySelect = {
  id: true,
  codeHash: true,
  userId: true,
  provider: true,
  expiresAt: true,
  usedAt: true,
  createdAt: true,
} satisfies Prisma.OAuthExchangeCodeSelect;

export type OAuthExchangeCodeRow = Prisma.OAuthExchangeCodeGetPayload<{
  select: typeof oauthExchangeCodeEntitySelect;
}>;

export function toOAuthExchangeCodeEntity(
  row: OAuthExchangeCodeRow,
): OAuthExchangeCodeEntity {
  return new OAuthExchangeCodeEntity(
    row.id,
    row.codeHash,
    row.userId,
    row.provider,
    row.expiresAt,
    row.usedAt,
    row.createdAt,
  );
}

export function toOAuthExchangeCodeEntityOrNull(
  row: OAuthExchangeCodeRow | null,
): OAuthExchangeCodeEntity | null {
  return row ? toOAuthExchangeCodeEntity(row) : null;
}

export function toOAuthExchangeCodeEntityList(
  rows: OAuthExchangeCodeRow[],
): OAuthExchangeCodeEntity[] {
  return rows.map(toOAuthExchangeCodeEntity);
}

export function toPrismaCreateOAuthExchangeCodeData(
  data: CreateOAuthExchangeCodeData,
): Prisma.OAuthExchangeCodeCreateInput {
  return {
    codeHash: data.codeHash,
    provider: data.provider,
    expiresAt: data.expiresAt,
    usedAt: data.usedAt,
    user: {
      connect: {
        id: data.userId,
      },
    },
  };
}
