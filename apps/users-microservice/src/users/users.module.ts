import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { JwtModule } from '@nestjs/jwt';
import { RmqModule } from '@app/rmq';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { USERS_RMQ_CLIENT } from './users.constants';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RmqModule.registerAsync({
      name: USERS_RMQ_CLIENT,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        url: appConfig.rabbitMqUrl,
        queue: appConfig.rabbitMqQueue,
      }),
    }),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        secret: appConfig.jwtAccessSecret,
        signOptions: {
          expiresIn: appConfig.jwtAccessExpiresIn,
        },
      }),
    }),
  ],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
