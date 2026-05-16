import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { UsersPrismaService } from './users-prisma.service';

@Module({
  imports: [AppConfigModule],
  providers: [UsersPrismaService],
  exports: [UsersPrismaService],
})
export class PrismaModule {}