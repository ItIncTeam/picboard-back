import { ValidationPipe, ValidationError } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { formatValidationErrors } from '@app/common';

export function createRpcValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const formatted = formatValidationErrors(errors);
      const firstMessage = formatted[0]?.message ?? 'Validation failed';

      return new RpcException({
        message: firstMessage,
        errors: formatted,
      });
    },
  });
}
