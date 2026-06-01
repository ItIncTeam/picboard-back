import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfig } from '../config/app.config';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { SignUpUserUseCase } from '../application/use-cases/sign-up-user/sign-up-user.use.case';
import { SignInUserUseCase } from '../application/use-cases/sign-in-user/sign-in-user.use.case';
import { CreateRefreshTokenUseCase } from '../application/use-cases/create-refresh-token/create-refresh-token.use-case';
import { RotateRefreshTokenUseCase } from '../application/use-cases/rotate-refresh-token/rotate-refresh-token.use-case';
import { LogOutUserUseCase } from '../application/use-cases/log-out-user/log-out-user.use.case';
import { UsersPrismaService } from '../infrastructure/prisma/users-prisma.service';
import { UsersRepository } from '../domain/repositories/users.repository';
import { PrismaUsersRepository } from '../infrastructure/prisma/prisma-users.repository';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository';
import { PrismaRefreshTokenRepository } from '../infrastructure/prisma/prisma-refresh-token.repository';
import { PasswordHasher } from '../domain/services/password-hasher';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { TokenService } from '../domain/services/token.service';
import { JwtTokenService } from '../infrastructure/security/jwt-token.service';
import { AuthResolver } from '../graphql/resolvers/auth.resolver';
import { EmailAdapter } from '../infrastructure/messaging/email.adapter';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfirmEmailUseCase } from '../application/use-cases/confirm-email/confirm-email.use.case';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CqrsModule,
    /*RmqModule.registerAsync({
      name: USERS_RMQ_CLIENT,
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (appConfig: AppConfig) => ({
        url: appConfig.rabbitMqUrl,
        queue: appConfig.rabbitMqQueue,
      }),
    }),*/
    /*ClientsModule.registerAsync([
      {
        name: 'POSTS_TCP_CLIENT',
        inject: [AppConfig],
        useFactory: (appConfig: AppConfig) => ({
          transport: Transport.TCP,
          options: {
            host: 0.0.0.0,
            port: 4001,
          },
        }),
      },
    ]),*/
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
    SignInUserUseCase,
    ConfirmEmailUseCase,
    CreateRefreshTokenUseCase,
    RotateRefreshTokenUseCase,
    LogOutUserUseCase,
    UsersPrismaService,
    EmailAdapter,
    /*UsersEventsPublisher,*/
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
    {
      provide: RefreshTokenRepository,
      useClass: PrismaRefreshTokenRepository,
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
