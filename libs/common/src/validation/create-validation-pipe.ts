import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { formatValidationErrors } from './format-validation-errors';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => {
      const formatted = formatValidationErrors(errors);
      const firstMessage = formatted[0]?.message ?? 'Validation failed';
      return new BadRequestException({
        message: firstMessage,
        errors: formatted,
      });
    },
  });
}
