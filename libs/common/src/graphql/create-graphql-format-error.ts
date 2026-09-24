import { GraphQLError, GraphQLFormattedError } from 'graphql';
import {
  FieldError,
  GraphqlApiErrorCode,
  OriginalGraphQlError,
} from './types/graphql-api-error.type';
import { unwrapResolverError } from '@apollo/server/errors';

// Runs twice for anything that crosses the gateway: once in the subgraph, then
// again in the gateway over the error the subgraph already formatted. So it has
// to be idempotent — it writes code/statusCode into `extensions` and reads them
// back from there, otherwise the second pass loses the first pass's work and
// degrades every error to 500.
export function createGraphqlFormatError(isProduction: boolean) {
  return (
    formattedError: GraphQLError,
    error: unknown,
  ): GraphQLFormattedError => {
    const unwrapped = unwrapResolverError(error);
    const resolverError = unwrapped as OriginalGraphQlError | undefined;
    const code = formattedError.extensions?.code;

    const defaultMessage =
      typeof formattedError.message === 'string'
        ? formattedError.message
        : 'Unexpected error';

    const message = Array.isArray(resolverError?.message)
      ? resolverError.message[0]
      : typeof resolverError?.message === 'string'
        ? resolverError.message
        : defaultMessage;

    // NestJS HttpException stores the response object in `.response`
    // unwrapResolverError may return the response object (without statusCode)
    const resolverResponse = (resolverError as any)?.response as
      | { message?: string; errors?: unknown; statusCode?: number }
      | undefined;

    const originalError = formattedError.extensions?.originalError as
      | { message?: string; errors?: unknown; statusCode?: number }
      | undefined;

    const errors = Array.isArray(resolverResponse?.errors)
      ? (resolverResponse.errors as FieldError[])
      : Array.isArray((resolverError as any)?.errors)
        ? ((resolverError as any).errors as FieldError[])
        : // second pass: field errors already normalized by the subgraph
          Array.isArray(formattedError.extensions?.errors)
          ? (formattedError.extensions.errors as FieldError[])
          : null;

    // Extract HTTP status from any source
    const getStatus = (expected: number) =>
      resolverError?.statusCode === expected ||
      resolverResponse?.statusCode === expected ||
      originalError?.statusCode === expected ||
      // second pass: status written into extensions by the subgraph
      formattedError.extensions?.statusCode === expected;

    const build = (
      apiCode: GraphqlApiErrorCode,
      statusCode: number,
      fallbackMessage: string,
      fieldErrors: FieldError[] | null = null,
    ): GraphQLFormattedError => ({
      message: message || fallbackMessage,
      ...(formattedError.locations && { locations: formattedError.locations }),
      ...(formattedError.path && { path: formattedError.path }),
      extensions: { code: apiCode, statusCode, errors: fieldErrors },
    });

    if (
      getStatus(400) ||
      errors !== null ||
      code === 'BAD_USER_INPUT' ||
      code === 'BAD_REQUEST'
    ) {
      return build('BAD_USER_INPUT', 400, 'Validation failed', errors);
    }

    if (getStatus(401) || code === 'UNAUTHENTICATED') {
      return build('UNAUTHENTICATED', 401, 'Unauthorized');
    }

    if (getStatus(403) || code === 'FORBIDDEN') {
      return build('FORBIDDEN', 403, 'Forbidden');
    }

    if (getStatus(404) || code === 'NOT_FOUND') {
      return build('NOT_FOUND', 404, 'Resource not found');
    }

    if (getStatus(409) || code === 'CONFLICT') {
      return build('CONFLICT', 409, 'Conflict');
    }

    if (getStatus(503) || code === 'SERVICE_UNAVAILABLE') {
      return build(
        'SERVICE_UNAVAILABLE',
        503,
        'Service temporarily unavailable',
      );
    }

    if (getStatus(504) || code === 'GATEWAY_TIMEOUT') {
      return build('GATEWAY_TIMEOUT', 504, 'Gateway timeout');
    }

    // written out rather than built: the message is deliberately fixed, not
    // taken from the resolver
    if (code === 'GRAPHQL_VALIDATION_FAILED') {
      return {
        message: 'GraphQL query validation failed',
        ...(formattedError.locations && {
          locations: formattedError.locations,
        }),
        extensions: {
          code: 'GRAPHQL_VALIDATION_FAILED',
          statusCode: 400,
          errors: null,
        },
      };
    }

    // likewise: build() would prefer `message` over the fallback, which in
    // production would hand the caller the internal message this branch exists
    // to hide
    return {
      message: isProduction ? 'Internal server error' : defaultMessage,
      ...(formattedError.locations && { locations: formattedError.locations }),
      ...(formattedError.path && { path: formattedError.path }),
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        errors: null,
      },
    };
  };
}
