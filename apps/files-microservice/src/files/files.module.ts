import { Module } from '@nestjs/common';
import { FilesResolver } from '../graphql/resolvers/files.resolver';
/*import { RmqModule } from '@app/rmq';
import { FILES_RMQ_CLIENT } from './files.constants';*/
import { AppConfigModule } from '../config/app-config.module';
/*import { AppConfig } from '../config/app.config';*/
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { FilesRepository } from '../domain/repositories/files/files.repository';
import { PrismaFilesRepository } from '../infrastructure/prisma/repositories/prisma-files/prisma-files.repository';
import { StorageService } from '../domain/services/awsS3Storage/storage.service';
import { AwsS3StorageService } from '../infrastructure/awsS3/awsS3Storage.service';
import { StorageKeyBuilder } from '../infrastructure/storage-key/storage-key-builder.service';
import { InitiateUploadBatchUseCase } from '../application/use-cases/initiate-upload/initiate-upload-batch.use.case';
import { FilesTcpController } from './tcp/files-tcp.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { CompleteUploadBatchUseCase } from '../application/use-cases/complete-upload/complete-upload-batch.use.case';
import { CheckOwnedReadyFilesHandler } from '../application/handlers/check-owned-ready-files/check-owned-ready-files.handler';
import { ResolveFileUrlUseCase } from '../application/use-cases/resolve-file-url/resolve-file-url.use.case';

@Module({
  imports: [
    AppConfigModule,
    /*RmqModule.registerAsync({
      name: FILES_RMQ_CLIENT,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        url: appConfig.rabbitMqUrl,
        queue: appConfig.rabbitMqQueue,
      }),
    }),*/
    CqrsModule,
    PrismaModule,
  ],
  controllers: [FilesTcpController],
  providers: [
    FilesResolver,
    InitiateUploadBatchUseCase,
    CompleteUploadBatchUseCase,
    ResolveFileUrlUseCase,
    CheckOwnedReadyFilesHandler,
    StorageKeyBuilder,
    {
      provide: FilesRepository,
      useClass: PrismaFilesRepository,
    },
    {
      provide: StorageService,
      useClass: AwsS3StorageService,
    },
  ],
})
export class FilesModule {}
