import { SetMetadata } from '@nestjs/common';

export const RECAPTCHA_ACTION_KEY = 'recaptcha_action';

export const Recaptcha = (action: string): MethodDecorator =>
  SetMetadata(RECAPTCHA_ACTION_KEY, action);
