import { OAuthAccountEntity } from '../../../domain/entities/oauth-account.entity';
import { CreateOAuthAccountData } from '../../../domain/repositories/oauth-account/create-oauth-account-data.type';

export const oauthAccountEntitySelect = {
  id: true,
  userId: true,
  provider: true,
  providerId: true,
  /*email: true,
  username: true,
  createdAt: true,*/
} satisfies Prisma.OAuthAccountSelect;

export type OAuthAccountEntityRow = Prisma.OAuthAccountGetPayload<{
  select: typeof oauthAccountEntitySelect;
}>;

export function toOAuthAccountEntity(
  row: OAuthAccountEntityRow,
): OAuthAccountEntity {
  return new OAuthAccountEntity(
    row.id,
    row.userId,
    row.provider,
    row.providerId,
  );
}

export function toOAuthAccountEntityOrNull(
  row: OAuthAccountEntityRow | null,
): OAuthAccountEntity | null {
  return row ? toOAuthAccountEntity(row) : null;
}

export function toOAuthAccountEntityList(
  rows: OAuthAccountEntityRow[],
): OAuthAccountEntity[] {
  return rows.map(toOAuthAccountEntity);
}

export function toPrismaCreateOAuthAccountData(
  data: CreateOAuthAccountData,
): Prisma.OAuthAccountCreateInput {
  return {
    user: {
      connect: {
        id: data.userId,
      },
    },
    provider: data.provider,
    providerId: data.providerId,
    email: data.email,
    username: data.username,
  };
}
