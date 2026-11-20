import { BadRequestException, GatewayTimeoutException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { catchError, firstValueFrom, of, type Observable } from 'rxjs';
import { HttpToRpcExceptionFilter } from './http-to-rpc-exception.filter';

const hostOf = (type: string) => ({ getType: () => type }) as never;

const captureError = async (source: unknown): Promise<unknown> =>
  firstValueFrom(
    (source as Observable<unknown>).pipe(catchError((e) => of(e))),
  );

describe('HttpToRpcExceptionFilter', () => {
  const filter = new HttpToRpcExceptionFilter();

  it('converts HttpException → RpcException preserving status/message/errors on rpc', async () => {
    const fieldErrors = [{ field: 'fileIds', message: 'fileIds must be uuid' }];

    const err = await captureError(
      filter.catch(
        new BadRequestException({
          message: 'Invalid file ids',
          errors: fieldErrors,
        }),
        hostOf('rpc'),
      ),
    );

    expect(err).toBeInstanceOf(RpcException);
    expect((err as RpcException).getError()).toEqual({
      statusCode: 400,
      message: 'Invalid file ids',
      errors: fieldErrors,
    });
  });

  it('preserves 504 status on rpc', async () => {
    const err = await captureError(
      filter.catch(
        new GatewayTimeoutException('Files repository request timed out'),
        hostOf('rpc'),
      ),
    );

    expect(err).toBeInstanceOf(RpcException);
    expect((err as RpcException).getError()).toMatchObject({
      statusCode: 504,
      message: 'Files repository request timed out',
    });
  });

  it('rethrows HttpException unchanged outside rpc (graphql)', () => {
    const exception = new BadRequestException('bad');

    expect(() => filter.catch(exception, hostOf('graphql'))).toThrow(exception);
  });
});
