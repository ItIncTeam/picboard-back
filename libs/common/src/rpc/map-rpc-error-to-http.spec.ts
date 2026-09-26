import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { TimeoutError } from 'rxjs';
import { mapRpcErrorToHttpException } from './map-rpc-error-to-http';

describe('mapRpcErrorToHttpException', () => {
  it('maps TimeoutError → 504 GatewayTimeout (with service label)', () => {
    const error = mapRpcErrorToHttpException(new TimeoutError(), {
      serviceLabel: 'Files service',
    });

    expect(error).toBeInstanceOf(GatewayTimeoutException);
    expect(error.getStatus()).toBe(504);
    expect(error.message).toContain('Files service timeout');
  });

  it('maps RPC 400 → BadRequest preserving field errors', () => {
    const fieldErrors = [{ field: 'fileIds', message: 'fileIds must be uuid' }];
    const error = mapRpcErrorToHttpException({
      statusCode: 400,
      message: 'Invalid file ids',
      errors: fieldErrors,
    });

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      message: 'Invalid file ids',
      errors: fieldErrors,
    });
  });

  it('maps RPC 401/403/404/409 to the matching HttpException', () => {
    expect(
      mapRpcErrorToHttpException({ statusCode: 401, message: 'nope' }),
    ).toBeInstanceOf(UnauthorizedException);
    expect(
      mapRpcErrorToHttpException({ statusCode: 403, message: 'nope' }),
    ).toBeInstanceOf(ForbiddenException);
    expect(
      mapRpcErrorToHttpException({ statusCode: 404, message: 'nope' }),
    ).toBeInstanceOf(NotFoundException);
    expect(
      mapRpcErrorToHttpException({ statusCode: 409, message: 'nope' }),
    ).toBeInstanceOf(ConflictException);
  });

  it('maps unknown error (no statusCode) → 503 ServiceUnavailable', () => {
    const error = mapRpcErrorToHttpException(new Error('ECONNREFUSED'), {
      serviceLabel: 'Files service',
    });

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getStatus()).toBe(503);
    expect(error.message).toContain('Files service unavailable');
  });

  it('uses the first message when message is an array', () => {
    const error = mapRpcErrorToHttpException({
      statusCode: 400,
      message: ['first', 'second'],
    });

    expect(error.getResponse()).toMatchObject({ message: 'first' });
  });
});
