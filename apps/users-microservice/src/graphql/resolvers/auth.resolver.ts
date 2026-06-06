import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { SignUpInput } from '../inputs/sign-up.input';
import { SignUpUserCommand } from '../../application/use-cases/sign-up-user/sign-up-user.use.case';
import { CommandBus } from '@nestjs/cqrs';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { SignUpPayload } from '../types/sign-up.payload';
import { SignInPayload } from '../types/sign-in.payload';
import { SignInInput } from '../inputs/sign-in.input';
import { SignInUserCommand } from '../../application/use-cases/sign-in-user/sign-in-user.use.case';
import { EmailConfirmationInput } from '../inputs/email-confirmation.input';
import { ConfirmEmailCommand } from '../../application/use-cases/confirm-email/confirm-email.use.case';
import { EmailConfirmationPayload } from '../types/email-confirmation.payload';
import { ResendConfirmationEmailCommand } from '../../application/use-cases/resend-confirmation-email/resend-confirmation-email';
import { ResendEmailInput } from '../inputs/resend-email.input';
import { EmailResendConfirmationPayload } from '../types/email-resend-confirmation.payload';
import { ResetPasswordCommand } from '../../application/use-cases/reset-password/reset-password.use.case';
import { PasswordResetInput } from '../inputs/password-reset.input';
import { PasswordResetPayload } from '../types/password-reset.payload';
import { SetNewPasswordCommand } from '../../application/use-cases/set-new-password/set-new-password.use.case';
import { SetNewPasswordPayload } from '../types/set-new-password.payload';
import { SetNewPasswordInput } from '../inputs/set-new-password.input';
import type { Request, Response } from 'express';
import { LogOutUserCommand } from '../../application/use-cases/log-out-user/log-out-user.use.case';
import { AccessTokenPayload } from '../types/access-token.payload';
import { RotateRefreshTokenCommand } from '../../application/use-cases/rotate-refresh-token/rotate-refresh-token.use-case';
import { UserEntity } from '../../domain/entities/user.entity';
import { Recaptcha, RecaptchaGuard } from '@app/common';

@UseGuards(RecaptchaGuard)
@Resolver()
export class AuthResolver {
  constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignUpPayload)
  async signUp(@Args('input') input: SignUpInput): Promise<SignUpPayload> {
    const user: UserEntity = await this.commandBus.execute(
      new SignUpUserCommand(input),
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isConfirmed: user.isConfirmed,
      },
      message: 'Confirmation email sent',
    };
  }

  @Mutation(() => EmailConfirmationPayload)
  async emailConfirmation(
    @Args('input') input: EmailConfirmationInput,
  ): Promise<EmailConfirmationPayload> {
    await this.commandBus.execute(new ConfirmEmailCommand(input.code));
    return {
      message: `If an account with that email exists, that email was confirmed`,
    };
  }

  @Mutation(() => EmailResendConfirmationPayload)
  async emailConfirmationResending(
    @Args('input') input: ResendEmailInput,
  ): Promise<EmailResendConfirmationPayload> {
    await this.commandBus.execute(
      new ResendConfirmationEmailCommand(input.email),
    );
    return {
      message:
        'If the account exists and is not confirmed, a new email was sent',
    };
  }

  @Mutation(() => SignInPayload)
  async signIn(
    @Args('input') input: SignInInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<SignInPayload> {
    const result = await this.commandBus.execute(new SignInUserCommand(input));

    const res = context.res;
    if (res) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        confirmationCode: result.user.confirmationCode,
        confirmationCodeExpDate: result.user.confirmationCodeExpDate,
        isConfirmed: result.user.isConfirmed,
        displayName: undefined,
        bio: undefined,
        profilePictureFileId: undefined,
      },
      accessToken: result.accessToken,
    };
  }

  @Mutation(() => String)
  async logout(
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    const refreshToken = context.req.cookies?.refreshToken;

    if (refreshToken) {
      await this.commandBus.execute(new LogOutUserCommand(refreshToken));
    }

    const res = context.res;
    if (res) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return 'Logged out';
  }

  @Mutation(() => AccessTokenPayload)
  async refreshToken(
    @Context() context: { req: Request; res: Response },
  ): Promise<AccessTokenPayload> {
    const oldRefreshToken = context.req.cookies?.refreshToken;

    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.commandBus.execute(
      new RotateRefreshTokenCommand(oldRefreshToken),
    );

    const res = context.res;
    if (res) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      accessToken: result.accessToken,
    };
  }

  @Mutation(() => PasswordResetPayload)
  @Recaptcha('password_reset')
  async passwordReset(
    @Args('input') input: PasswordResetInput,
  ): Promise<PasswordResetPayload> {
    /*await this.recaptchaV3Service.ensureHuman(
      input.captchaToken,
      'password_reset', // must match frontend action
    );*/

    await this.commandBus.execute(new ResetPasswordCommand(input.email));
    return {
      message:
        'If an account with that email exists, recovery instructions were sent.',
    };
  }

  @Mutation(() => SetNewPasswordPayload)
  async setNewPassword(
    @Args('input') input: SetNewPasswordInput,
  ): Promise<SetNewPasswordPayload> {
    await this.commandBus.execute(
      new SetNewPasswordCommand(input.code, input.password),
    );
    return {
      message: 'If an account with that email exists, new password was set.',
    };
  }
}
