import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { CreateRefreshTokenData } from '../../domain/repositories/create-refresh-token-data.type';
import { UsersPrismaService } from './users-prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        device: data.device,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByToken(token: string): Promise<{
    userId: string;
    expiresAt: Date;
  } | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true },
    });

    return record;
  }

  async deleteByToken(token: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { token },
    });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
