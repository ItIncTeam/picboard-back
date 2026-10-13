import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../domain/repositories/users.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UsersPrismaService } from './users-prisma.service';
import { CreateUserData } from '../../domain/repositories/create-user-data.type';
import { UpdateConfirmationData } from '../../domain/repositories/update-confirmation-data.type';
import { User } from '../../../../../prisma/apps/users/src/generated/prisma/users-client';
import {
  mapToUserEntity,
  mapToUserEntityOrNull,
  mapToUserEntities,
} from './mappers/user.mapper';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
    });

    return mapToUserEntities(users);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return mapToUserEntityOrNull(user);
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { username },
      /*select: userEntitySelect,*/
    });

    if (!user) {
      return null;
    }

    return mapToUserEntityOrNull(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return mapToUserEntityOrNull(user);
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

    return mapToUserEntity(user);
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

    return mapToUserEntityOrNull(user);
  }

  async confirmUserEmail(id: string): Promise<UserEntity> {
    const user: User = await this.prisma.user.update({
      where: { id: id },
      data: { isConfirmed: true },
    });

    return mapToUserEntity(user);
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

    return mapToUserEntity(user);
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

    return mapToUserEntity(user);
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}
