import { GraphQLError } from 'graphql';
import {
  GraphqlApiError,
  OriginalGraphQlError,
} from './types/graphql-api-error.type';
import { unwrapResolverError } from '@apollo/server/errors';

export function createGraphqlFormatError(isProduction: boolean) {
  return (formattedError: GraphQLError, error: unknown): GraphqlApiError => {
    const unwrapped = unwrapResolverError(error);
    const resolverError = unwrapped as OriginalGraphQlError | undefined;
    const code = formattedError.extensions?.code;
    /* const originalError = error.extensions?.originalError as
      | OriginalGraphQlError
      | undefined;*/

    const defaultMessage =
      typeof formattedError.message === 'string'
        ? formattedError.message
        : 'Unexpected error';

    const message = Array.isArray(resolverError?.message)
      ? resolverError.message[0]
      : typeof resolverError?.message === 'string'
        ? resolverError.message
        : defaultMessage;

    if (
      resolverError?.statusCode === 400 ||
      code === 'BAD_USER_INPUT' ||
      code === 'BAD_REQUEST' ||
      message === 'Validation failed'
    ) {
      return {
        message: message || 'Validation failed',
        code: 'BAD_USER_INPUT',
        statusCode: 400,
        errors: resolverError?.errors ?? null,
      };
    }

    if (resolverError?.statusCode === 401 || code === 'UNAUTHENTICATED') {
      return {
        message: message || 'Unauthorized',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
        errors: null,
      };
    }

    if (resolverError?.statusCode === 403 || code === 'FORBIDDEN') {
      return {
        message: message || 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
        errors: null,
      };
    }

    if (resolverError?.statusCode === 404 || code === 'NOT_FOUND') {
      return {
        message: message || 'Resource not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        errors: null,
      };
    }

    if (resolverError?.statusCode === 409 || code === 'CONFLICT') {
      return {
        message: message || 'Conflict',
        code: 'CONFLICT',
        statusCode: 409,
        errors: null,
      };
    }

    if (code === 'GRAPHQL_VALIDATION_FAILED') {
      return {
        message: 'GraphQL query validation failed',
        code: 'GRAPHQL_VALIDATION_FAILED',
        statusCode: 400,
        errors: null,
      };
    }

    return {
      message: isProduction ? 'Internal server error' : defaultMessage,
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      errors: null,
    };
  };
}
