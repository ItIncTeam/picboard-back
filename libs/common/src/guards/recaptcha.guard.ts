import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RecaptchaV3Service } from '../../../../apps/users-microservice/src/infrastructure/security/recaptcha-v3.service';
import { RECAPTCHA_ACTION_KEY } from '@app/common/decorators/metadata/recaptcha';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly recaptchaV3Service: RecaptchaV3Service,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>(
      RECAPTCHA_ACTION_KEY,
      context.getHandler(),
    );

    // If no @Recaptcha() on this handler, skip.
    if (!action) {
      return true;
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const args = gqlCtx.getArgs();

    const captchaToken: string | null =
      args?.input?.captchaToken ?? args?.captchaToken ?? null;

    if (!captchaToken) {
      throw new BadRequestException('Captcha token is missing');
    }

    await this.recaptchaV3Service.ensureHuman(captchaToken, action);

    return true;
  }
}
