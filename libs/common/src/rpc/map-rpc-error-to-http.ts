import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { TimeoutError } from 'rxjs';

/**
 * Форма ошибки, которую RPC-клиент получает от RPC-сервера.
 * NestJS прокидывает `RpcException.getError()` на клиент как есть
 * (см. @nestjs/microservices base-rpc-exception-filter.js), поэтому
 * `statusCode`/`message`/`errors` лежат прямо на объекте ошибки.
 */
export type RpcErrorPayload = {
  statusCode?: number;
  message?: string | string[];
  errors?: unknown;
};

export type MapRpcErrorOptions = {
  /** Метка сервиса для сообщений таймаута/недоступности, напр. 'Files service'. */
  serviceLabel?: string;
};

/**
 * Преобразует ошибку, пришедшую от RPC-сервера (NestJS microservices), в
 * `HttpException` с сохранением статуса и деталей валидации.
 *
 * - таймаут → 504
 * - известные 4xx (`statusCode`) → соответствующий HttpException (с `errors`)
 * - сетевые сбои / нет обработчика / неклассифицируемое → 503
 *
 * Вместо возврата можно бросать: `throw mapRpcErrorToHttpException(error)`.
 */
export function mapRpcErrorToHttpException(
  error: unknown,
  options: MapRpcErrorOptions = {},
): HttpException {
  const label = options.serviceLabel ?? 'Downstream service';

  if (error instanceof TimeoutError) {
    return new GatewayTimeoutException(`${label} timeout`);
  }

  const rpc = error as RpcErrorPayload;
  const message = Array.isArray(rpc?.message)
    ? rpc.message[0]
    : rpc?.message;

  switch (rpc?.statusCode) {
    case 400:
      return new BadRequestException({
        message: message ?? 'Bad request',
        errors: rpc.errors ?? null,
      });
    case 401:
      return new UnauthorizedException(message ?? 'Unauthorized');
    case 403:
      return new ForbiddenException(message ?? 'Forbidden');
    case 404:
      return new NotFoundException(message ?? 'Resource not found');
    case 409:
      return new ConflictException(message ?? 'Conflict');
    default:
      // сеть / нет обработчика / неклассифицируемая ошибка → сервис недоступен
      return new ServiceUnavailableException(`${label} unavailable`);
  }
}
