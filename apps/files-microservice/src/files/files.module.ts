import { Module } from '@nestjs/common';
import { FilesResolver } from './files.resolver';
import { FilesService } from './files.service';
// import { RmqModule } from '@app/rmq';
import { FILES_RMQ_CLIENT } from './files.constants';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    // RmqModule.registerAsync({
    //   name: FILES_RMQ_CLIENT,
    //   imports: [AppConfigModule],
    //   inject: [AppConfig],
    //   useFactory: (appConfig: AppConfig) => ({
    //     url: appConfig.rabbitMqUrl,
    //     queue: appConfig.rabbitMqQueue,
    //   }),
    // }),
    PrismaModule,
  ],
  providers: [FilesResolver, FilesService],
})
export class FilesModule {}
