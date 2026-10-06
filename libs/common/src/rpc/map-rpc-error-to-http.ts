import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { TimeoutError } from 'rxjs';
import type { RpcErrorPayload } from '@app/contracts';

/**
 * То, что клиент реально получает от RPC-сервера: канонический `RpcErrorPayload`
 * (@app/contracts), но поля необязательны, а `message` может прийти массивом —
 * NestJS кладёт `RpcException.getError()` на клиент как есть
 * (см. @nestjs/microservices base-rpc-exception-filter.js).
 */
type ReceivedRpcError = Partial<Omit<RpcErrorPayload, 'message'>> & {
  message?: string | string[];
};

export type MapRpcErrorOptions = {
  /** Метка сервиса для сообщений таймаута/недоступности, напр. 'Files service'. */
  serviceLabel?: string;
};

/**
 * Преобразует ошибку, пришедшую от RPC-сервера (NestJS microservices), в
 * `HttpException` с сохранением статуса и деталей валидации.
 *
 * - клиентский таймаут → 504
 * - известные 4xx (`statusCode`) → соответствующий HttpException (с `errors`)
 * - 500 → InternalServerError, 504 → GatewayTimeout
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

  const rpc = error as ReceivedRpcError;
  const message = Array.isArray(rpc?.message) ? rpc.message[0] : rpc?.message;

  switch (rpc?.statusCode) {
    case 400:
      return new BadRequestException({
        message: message ?? 'Bad request',
        errors: rpc.errors ?? null,
        ...(rpc.code !== undefined ? { domainCode: rpc.code } : {}),
      });
    case 401:
      if (rpc.code !== undefined) {
        return new UnauthorizedException({
          message: message ?? 'Unauthorized',
          domainCode: rpc.code,
        });
      }
      return new UnauthorizedException(message ?? 'Unauthorized');
    case 403:
      if (rpc.code !== undefined) {
        return new ForbiddenException({
          message: message ?? 'Forbidden',
          domainCode: rpc.code,
        });
      }
      return new ForbiddenException(message ?? 'Forbidden');
    case 404:
      if (rpc.code !== undefined) {
        return new NotFoundException({
          message: message ?? 'Resource not found',
          domainCode: rpc.code,
        });
      }
      return new NotFoundException(message ?? 'Resource not found');
    case 409:
      if (rpc.code !== undefined) {
        return new ConflictException({
          message: message ?? 'Conflict',
          domainCode: rpc.code,
        });
      }
      return new ConflictException(message ?? 'Conflict');
    case 500:
      if (rpc.code !== undefined) {
        return new InternalServerErrorException({
          message: message ?? `${label} error`,
          domainCode: rpc.code,
        });
      }
      return new InternalServerErrorException(message ?? `${label} error`);
    case 504:
      if (rpc.code !== undefined) {
        return new GatewayTimeoutException({
          message: message ?? `${label} timeout`,
          domainCode: rpc.code,
        });
      }
      return new GatewayTimeoutException(message ?? `${label} timeout`);
    default:
      if (rpc.code !== undefined) {
        return new ServiceUnavailableException({
          message: `${label} unavailable`,
          domainCode: rpc.code,
        });
      }
      return new ServiceUnavailableException(`${label} unavailable`);
  }
}
