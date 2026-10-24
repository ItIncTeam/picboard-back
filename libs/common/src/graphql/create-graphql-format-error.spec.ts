import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createGraphqlFormatError } from './create-graphql-format-error';

const fmt = createGraphqlFormatError(false);

// формирует минимальный «GraphQLError-подобный» вход форматтера
const gqlErr = (message: string, originalError?: unknown) =>
  ({ message, extensions: { originalError } }) as any;

describe('createGraphqlFormatError — domain codes (B1)', () => {
  it('keeps transport code for NotFoundException', () => {
    const out = fmt(
      gqlErr('nope', { statusCode: 404, message: 'nope' }),
      new NotFoundException('nope'),
    );
    expect(out.extensions?.code).toBe('NOT_FOUND');
    expect(out.extensions?.statusCode).toBe(404);
  });

  it('maps validation errors to BAD_USER_INPUT 400 with field errors', () => {
    const ex = new BadRequestException({
      message: 'bad',
      errors: [{ field: 'username', message: 'bad' }],
    });
    const out = fmt(gqlErr('bad', { statusCode: 400, message: 'bad' }), ex);
    expect(out.extensions?.code).toBe('BAD_USER_INPUT');
    expect(out.extensions?.statusCode).toBe(400);
    expect(out.extensions?.errors).toEqual([
      { field: 'username', message: 'bad' },
    ]);
  });

  it('surfaces domain code (USER_UNDER_13) with 400', () => {
    const ex = new BadRequestException({
      message: 'A user under 13',
      domainCode: 'USER_UNDER_13',
    });
    const out = fmt(
      gqlErr('A user under 13', {
        statusCode: 400,
        message: 'A user under 13',
      }),
      ex,
    );
    expect(out.extensions?.code).toBe('USER_UNDER_13');
    expect(out.extensions?.statusCode).toBe(400);
  });

  it('surfaces USERNAME_TAKEN and preserves 409 even with field errors', () => {
    const ex = new ConflictException({
      message: 'taken',
      domainCode: 'USERNAME_TAKEN',
      errors: [{ field: 'username', message: 'taken' }],
    });
    const out = fmt(gqlErr('taken', { statusCode: 409, message: 'taken' }), ex);
    expect(out.extensions?.code).toBe('USERNAME_TAKEN');
    expect(out.extensions?.statusCode).toBe(409);
  });

  it('is idempotent: domain code survives the second pass', () => {
    const first = fmt(
      gqlErr('taken', { statusCode: 409, message: 'taken' }),
      new ConflictException({
        message: 'taken',
        domainCode: 'USERNAME_TAKEN',
      }),
    );
    const second = fmt(
      { message: first.message, extensions: first.extensions } as any,
      new Error('taken'),
    );
    expect(second.extensions?.code).toBe('USERNAME_TAKEN');
    expect(second.extensions?.statusCode).toBe(409);
  });
});
