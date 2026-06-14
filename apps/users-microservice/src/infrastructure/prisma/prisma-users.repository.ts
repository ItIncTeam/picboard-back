import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../domain/repositories/users.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { OAuthAccountEntity } from '../../domain/entities/oauth-account.entity';
import { UsersPrismaService } from './users-prisma.service';
import { CreateUserData } from '../../domain/repositories/create-user-data.type';
import { CreateOAuthAccountData } from '../../domain/repositories/oauth-account/create-oauth-account-data.type';
import { UpdateConfirmationData } from '../../domain/repositories/update-confirmation-data.type';
import { User } from '../../../../../prisma/apps/users/src/generated/prisma/users-client';

/*//A REUSABLE MAPPER:
//examples in comments in methods below

// user.prisma-mapper.ts
export const userEntitySelect = {
  id: true,
  email: true,
  username: true,
  passwordHash: true,
  createdAt: true,
  confirmationCode: true,
  confirmationCodeExpDate: true,
  isConfirmed: true,
} satisfies Prisma.UserSelect;

export type UserEntityRow = Prisma.UserGetPayload<{
  select: typeof userEntitySelect;
}>;

export function mapToUserEntity(user: UserEntityRow): UserEntity {
  return new UserEntity(
    user.id,
    user.email,
    user.username,
    user.passwordHash,
    user.createdAt,
    user.confirmationCode,
    user.confirmationCodeExpDate,
    user.isConfirmed,
  );

  export function mapToUserEntityOrNull(
  row: UserEntityRow | null,
): UserEntity | null {
  return row ? mapToUserEntity(row) : null;
}

export function mapToUserEntities(rows: UserEntityRow[]): UserEntity[] {
  return rows.map(mapToUserEntity);
}

export function mapCreateUserDataToPrisma(data: CreateUserData): Prisma.UserCreateInput {
  return {
    email: data.email,
    username: data.username,
    passwordHash: data.passwordHash,
    confirmationCode: data.confirmationCode,
    confirmationCodeExpDate: data.confirmationCodeExpDate,
    isConfirmed: data.isConfirmed,
  };
}
}*/

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findById(id: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { username },
      /*select: userEntitySelect,*/
    });

    if (!user) {
      return null;
    }

    /*return mapToUserEntityOrNull(user);*/
    /*same with all FIND*/
    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        confirmationCode: data.confirmationCode,
        confirmationCodeExpDate: data.confirmationCodeExpDate,
        isConfirmed: data.isConfirmed,
      } /*mapCreateUserDataToPrisma(data)*/,
      /* select: userEntitySelect,*/
    });

    /*return mapToUserEntity(user);*/
    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async findByConfirmationCode(
    confirmationCode: string,
  ): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findFirst({
      where: { confirmationCode },
    });

    if (!user) {
      return null;
    }

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async confirmUserEmail(id: string): Promise<UserEntity> {
    const user: User = await this.prisma.user.update({
      where: { id: id },
      data: { isConfirmed: true },
    });

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  /*async findManyConfirmed(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: { isConfirmed: true },
      orderBy: { createdAt: 'desc' },
      select: userEntitySelect,
    });

    return mapToUserEntities(users);
  }*/

  async updateConfirmationData(
    userId: string,
    data: UpdateConfirmationData,
  ): Promise<UserEntity> {
    const user: User = await this.prisma.user.update({
      where: { id: userId },
      data: {
        confirmationCode: data.confirmationCode,
        confirmationCodeExpDate: data.confirmationCodeExpDate,
      },
    });

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<UserEntity> {
    const user: User = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: passwordHash,
      },
    });

    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.createdAt,
      user.confirmationCode,
      user.confirmationCodeExpDate,
      user.isConfirmed,
    );
  }

  async findOAuthAccountByProvider(
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

  async createOAuthAccount(
    data: CreateOAuthAccountData,
  ): Promise<OAuthAccountEntity> {
    const account = await this.prisma.oAuthAccount.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerId: data.providerId,
        username: data.username,
        email: data.email,
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
