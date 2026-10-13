import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { RpcException } from '@nestjs/microservices';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';
import { throwError } from 'rxjs';
import type { Response } from 'express';
import { mapPrismaErrorCode } from '../filters/map-prisma-error-code';
import {
  PRISMA_EXCEPTION_OPTIONS,
} from './prisma-exception.constants';
import type { PrismaExceptionOptions } from './prisma-exception.constants';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(
    @Inject(PRISMA_EXCEPTION_OPTIONS)
    private readonly options: PrismaExceptionOptions,
  ) {}

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    this.logger.error(
      JSON.stringify({
        event: 'prisma_known_request_error',
        code: exception.code,
        meta: exception.meta,
      }),
    );

    const mapped =
      mapPrismaErrorCode(exception.code) ??
      new InternalServerErrorException('Database error occurred');

    const error = this.withErrorCode(mapped, exception.code);

    switch (host.getType<GqlContextType>()) {
      case 'graphql':
        throw error;

      case 'rpc':
        return throwError(
          () =>
            new RpcException({
              statusCode: error.getStatus(),
              message: error.message,
            }),
        );

      default: {
        const response = host.switchToHttp().getResponse<Response>();
        response.status(error.getStatus()).json(error.getResponse());
      }
    }
  }

  private withErrorCode(error: HttpException, code: string): HttpException {
    if (!this.options.exposeErrorCode) return error;

    const ExceptionClass = error.constructor as new (
      message: string,
    ) => HttpException;

    return new ExceptionClass(`${error.message} (${code})`);
  }
}
