import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { FilesPrismaService } from './files-prisma.service';

@Module({
  imports: [AppConfigModule],
  providers: [FilesPrismaService],
  exports: [FilesPrismaService],
})
export class PrismaModule {}
