import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { SignUpInput } from '../inputs/sign-up.input';
import { SignUpUserCommand } from '../../application/use-cases/sign-up-user/sign-up-user.use.case';
import { CommandBus } from '@nestjs/cqrs';
import { SignUpPayload } from '../types/sign-up.payload';
import { SignInPayload } from '../types/sign-in.payload';
import { SignInInput } from '../inputs/sign-in.input';
import { SignInUserCommand } from '../../application/use-cases/sign-in-user/sign-in-user.use.case';
import { EmailConfirmationInput } from '../inputs/email-confirmation.input';
import { ConfirmEmailCommand } from '../../application/use-cases/confirm-email/confirm-email.use.case';
import { EmailConfirmationPayload } from '../types/email-confirmation.payload';
import type { Response } from 'express';

@Resolver()
export class AuthResolver {
  constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignUpPayload)
  async signUp(@Args('input') input: SignUpInput): Promise<SignUpPayload> {
    const user = await this.commandBus.execute(new SignUpUserCommand(input));
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
        displayName: undefined,
        bio: undefined,
        profilePictureFileId: undefined,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Mutation(() => EmailConfirmationPayload)
  async emailConfirmation(
    @Args('input') input: EmailConfirmationInput,
  ): Promise<EmailConfirmationPayload> {
    const user = await this.commandBus.execute(new ConfirmEmailCommand(input));
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isConfirmed: user.isConfirmed,
      },
      message: `User's email confirmed`,
    };
  }
}
