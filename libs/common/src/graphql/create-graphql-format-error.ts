import { GraphQLError } from 'graphql';
import {
  FieldError,
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
        : null;

    // Extract HTTP status from any source
    const getStatus = (expected: number) =>
      resolverError?.statusCode === expected ||
      resolverResponse?.statusCode === expected ||
      originalError?.statusCode === expected;

    if (
      getStatus(400) ||
      errors !== null ||
      code === 'BAD_USER_INPUT' ||
      code === 'BAD_REQUEST'
    ) {
      return {
        message: message || 'Validation failed',
        code: 'BAD_USER_INPUT',
        statusCode: 400,
        errors,
      };
    }

    if (getStatus(401) || code === 'UNAUTHENTICATED') {
      return {
        message: message || 'Unauthorized',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
        errors: null,
      };
    }

    if (getStatus(403) || code === 'FORBIDDEN') {
      return {
        message: message || 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
        errors: null,
      };
    }

    if (getStatus(404) || code === 'NOT_FOUND') {
      return {
        message: message || 'Resource not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        errors: null,
      };
    }

    if (getStatus(409) || code === 'CONFLICT') {
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
