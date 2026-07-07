import { Module } from '@nestjs/common';
import { FilesResolver } from '../graphql/resolvers/files.resolver';
import { AppConfigModule } from '../config/app-config.module';
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
import { GetFileByIdQueryHandler } from '../application/handlers/get-file-by-id/get-file-by-id.handler';
import { SoftDeleteFilesUseCase } from '../application/use-cases/soft-delete-files/soft-delete-files.use.case';

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
    SoftDeleteFilesUseCase,
    CheckOwnedReadyFilesHandler,
    GetFileByIdQueryHandler,
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
