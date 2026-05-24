import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { JwtModule } from '@nestjs/jwt';
import { RmqModule } from '@app/rmq';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { USERS_RMQ_CLIENT } from './users.constants';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { SignUpUserUseCase } from '../application/use-cases/sign-up-user/sign-up-user.use.case';
import { UsersPrismaService } from '../infrastructure/prisma/users-prisma.service';
import { UsersRepository } from '../domain/repositories/users.repository';
import { PrismaUsersRepository } from '../infrastructure/prisma/prisma-users.repository';
import { PasswordHasher } from '../domain/services/password-hasher';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { TokenService } from '../domain/services/token.service';
import { JwtTokenService } from '../infrastructure/security/jwt-token.service';
import { AuthResolver } from '../graphql/resolvers/auth.resolver';
import { EmailAdapter } from '../infrastructure/messaging/email.adapter';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CqrsModule,
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
  providers: [
    UsersResolver,
    UsersService,
    AuthResolver,
    SignUpUserUseCase,
    UsersPrismaService,
    EmailAdapter,
    /*UsersEventsPublisher,*/
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
    {
      provide: PasswordHasher,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: TokenService,
      useClass: JwtTokenService,
    },
    /*{
      provide: APP_FILTER,
      useClass: UsersPrismaExceptionFilter,
    },*/
  ],
})
export class UsersModule {}
