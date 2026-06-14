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
import { ResendConfirmationEmailUseCase } from '../application/use-cases/resend-confirmation-email/resend-confirmation-email';
import { OAuthLoginUseCase } from '../application/use-cases/oauth-login/oauth-login.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password/reset-password.use.case';
import { SetNewPasswordUseCase } from '../application/use-cases/set-new-password/set-new-password.use.case';
import { ConsentRepository } from '../domain/repositories/consent/consent.repository';
import { PrismaConsentRepository } from '../infrastructure/prisma/repositories/prisma-consent/prisma-consent.repository';
import { RecaptchaV3Service } from '../infrastructure/security/recaptcha-v3.service';
import { GoogleOAuthController } from '../infrastructure/googleOAuth/googleOAuth.controller';
import { CompleteGoogleOAuthUseCase } from '../application/use-cases/complete-google-oAuth/complete-google-oAuth.use.case';
import { OAuthExchangeCodeUseCase } from '../application/use-cases/exchange-oauth-code/exchange-oauth-code.use.case';
import { CreateOAuthExchangeCodeUseCase } from '../application/use-cases/create-oauth-exchange-code/create-oauth-exchange-code.use.case';
import { CompleteGoogleOAuthLoginUseCase } from '../application/use-cases/complete-google-oAuth-login/complete-google-oAuth-login.use.case';
import { OAuthAccountsRepository } from '../domain/repositories/oauth-account/oauth-accounts.repository';
import { PrismaOAuthAccountsRepository } from '../infrastructure/prisma/repositories/prisma-oauth-account/prisma-oauth-accounts.repository';
import { PrismaOAuthExchangeCodesRepository } from '../infrastructure/prisma/repositories/prisma-oauth-exchange-code/prisma-oauth-exchange-codes.repository';
import { OAuthExchangeCodesRepository } from '../domain/repositories/oauth-exchange-code/oauth-exchange-codes.repository';
import { IssueSessionUseCase } from '../application/use-cases/issue-session/issue-session.use.case';
import { UsernameGeneratorService } from '../infrastructure/googleOAuth/username-generator.service';

/*import { OAuthModule } from '../infrastructure/githubOAuth/oauth.module';*/
import { GitHubOAuthController } from '../infrastructure/githubOAuth/github-oauth.controller';
import { GithubOAuthService } from '../infrastructure/githubOAuth/github-oauth.service';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CqrsModule,
    /*OAuthModule,*/
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
  controllers: [GoogleOAuthController, GitHubOAuthController],
  providers: [
    GithubOAuthService,
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
    RecaptchaV3Service,
    EmailAdapter,
    ResendConfirmationEmailUseCase,
    ResetPasswordUseCase,
    SetNewPasswordUseCase,
    CompleteGoogleOAuthUseCase,
    CompleteGoogleOAuthLoginUseCase,
    OAuthExchangeCodeUseCase,
    CreateOAuthExchangeCodeUseCase,
    IssueSessionUseCase,
    UsernameGeneratorService,
    OAuthLoginUseCase,
    /*UsersEventsPublisher,*/
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
    {
      provide: OAuthAccountsRepository,
      useClass: PrismaOAuthAccountsRepository,
    },
    {
      provide: OAuthExchangeCodesRepository,
      useClass: PrismaOAuthExchangeCodesRepository,
    },
    {
      provide: RefreshTokenRepository,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: ConsentRepository,
      useClass: PrismaConsentRepository,
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
