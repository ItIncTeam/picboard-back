import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { GqlContextType } from '@nestjs/graphql';
import { throwError } from 'rxjs';
import type { Response } from 'express';
import type { RpcErrorField, RpcErrorPayload } from '@app/contracts';

/**
 * Переводит `HttpException` → `RpcException` на RPC-границе, сохраняя статус,
 * сообщение и (при наличии) поле `errors`.
 *
 * Зачем: дефолтный `BaseRpcExceptionFilter` пропускает на клиент как есть только
 * `RpcException`; любой другой класс он заворачивает в
 * `{ status: 'error', message: 'Internal server error' }`. Из-за этого, например,
 * `GatewayTimeoutException` (504) из files-хендлера доезжает до posts без кода,
 * и клиентский `mapRpcErrorToHttpException` уводит её в `default → 503`.
 *
 * Повторяет паттерн `PrismaExceptionFilter`: переводим только в rpc-контексте,
 * в graphql/http не вмешиваемся.
 */
@Catch(HttpException)
export class HttpToRpcExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): unknown {
    switch (host.getType<GqlContextType>()) {
      case 'graphql':
        // отдаём штатному createGraphqlFormatError
        throw exception;

      case 'rpc': {
        const body = exception.getResponse();
        const raw = typeof body === 'string' ? { message: body } : body;
        const errors = (raw as { errors?: RpcErrorField[] | null }).errors;

        const payload: RpcErrorPayload = {
          statusCode: exception.getStatus(),
          message:
            typeof (raw as { message?: unknown }).message === 'string'
              ? (raw as { message: string }).message
              : exception.message,
          ...(errors !== undefined ? { errors } : {}),
          ...((raw as { domainCode?: string }).domainCode !== undefined
            ? { code: (raw as { domainCode?: string }).domainCode }
            : {}),
        };

        return throwError(() => new RpcException(payload));
      }

      default: {
        const response = host.switchToHttp().getResponse<Response>();
        response.status(exception.getStatus()).json(exception.getResponse());
      }
    }
  }
}
