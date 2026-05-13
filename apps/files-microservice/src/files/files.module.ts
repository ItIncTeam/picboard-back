import { Module } from '@nestjs/common';
import { FilesResolver } from './files.resolver';
import { FilesService } from './files.service';
import { FilesPrismaService } from '../prisma/files-prisma.service';
import { RmqModule } from '@app/rmq';

@Module({
  /*imports: [],
  controllers: [],*/
  imports: [RmqModule.register()],
  providers: [FilesResolver, FilesService, FilesPrismaService],
})
export class FilesModule {}
