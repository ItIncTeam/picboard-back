import { ValidationPipe, ValidationError } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { RpcErrorPayload } from '@app/contracts';
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

      const payload: RpcErrorPayload = {
        statusCode: 400,
        message: firstMessage,
        errors: formatted,
      };

      return new RpcException(payload);
    },
  });
}
