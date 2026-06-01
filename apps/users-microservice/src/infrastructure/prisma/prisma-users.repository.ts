import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../domain/repositories/users.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UsersPrismaService } from './users-prisma.service';
import { CreateUserData } from '../../domain/repositories/create-user-data.type';
import { UpdateConfirmationData } from '../../domain/repositories/update-confirmation-data.type';
import { User } from '../../../../../prisma/apps/users/src/generated/prisma/users-client';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { username },
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

  async create(data: CreateUserData): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        confirmationCode: data.confirmationCode,
        confirmationCodeExpDate: data.confirmationCodeExpDate,
        isConfirmed: data.isConfirmed,
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
}
