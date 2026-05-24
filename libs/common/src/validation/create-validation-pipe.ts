import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { formatValidationErrors } from './format-validation-errors';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => {
      return new BadRequestException({
        message: 'Validation failed',
        errors: formatValidationErrors(errors),
      });
    },
  });
}
