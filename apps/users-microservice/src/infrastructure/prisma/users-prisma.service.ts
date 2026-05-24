import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../config/app.config';
import { PrismaClient } from '../../../../../prisma/apps/users/src/generated/prisma/users-client';

@Injectable()
export class UsersPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(appConfig: AppConfig) {
    const adapter = new PrismaPg({
      connectionString: appConfig.databaseUrl,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
