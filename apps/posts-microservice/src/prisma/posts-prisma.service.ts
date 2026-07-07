import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../prisma/apps/posts/src/generated/prisma/posts-client';
import { AppConfig } from '../config/app.config';

@Injectable()
export class PostsPrismaService
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

export { Prisma } from '../../../../prisma/apps/posts/src/generated/prisma/posts-client';
