import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { PostsPrismaService } from './posts-prisma.service';

@Module({
  imports: [AppConfigModule],
  providers: [PostsPrismaService],
  exports: [PostsPrismaService],
})
export class PrismaModule {}