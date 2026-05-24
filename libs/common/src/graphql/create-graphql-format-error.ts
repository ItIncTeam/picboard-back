import { GraphQLError } from 'graphql';
import { GraphqlApiError } from './types/graphql-api-error.type';

type OriginalGraphQlError = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
};

export function createGraphqlFormatError(isProduction: boolean) {
  return (error: GraphQLError): GraphqlApiError => {
    const code = error.extensions?.code;
    const originalError = error.extensions?.originalError as
      | OriginalGraphQlError
      | undefined;

    const defaultMessage =
      typeof error.message === 'string' ? error.message : 'Unexpected error';

    const originalMessage = Array.isArray(originalError?.message)
      ? originalError.message[0]
      : typeof originalError?.message === 'string'
        ? originalError.message
        : defaultMessage;

    if (
      originalError?.statusCode === 400 ||
      code === 'BAD_USER_INPUT' ||
      code === 'BAD_REQUEST'
    ) {
      return {
        message: originalMessage || 'Validation failed',
        code: 'BAD_USER_INPUT',
        statusCode: originalError?.statusCode ?? 400,
        errors: originalError?.errors ?? null,
      };
    }

    if (originalError?.statusCode === 401 || code === 'UNAUTHENTICATED') {
      return {
        message: originalMessage || 'Unauthorized',
        code: 'UNAUTHENTICATED',
        statusCode: originalError?.statusCode ?? 401,
        errors: null,
      };
    }

    if (originalError?.statusCode === 403 || code === 'FORBIDDEN') {
      return {
        message: originalMessage || 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: originalError?.statusCode ?? 403,
        errors: null,
      };
    }

    if (originalError?.statusCode === 404 || code === 'NOT_FOUND') {
      return {
        message: originalMessage || 'Resource not found',
        code: 'NOT_FOUND',
        statusCode: originalError?.statusCode ?? 404,
        errors: null,
      };
    }

    if (originalError?.statusCode === 409 || code === 'CONFLICT') {
      return {
        message: originalMessage || 'Conflict',
        code: 'CONFLICT',
        statusCode: originalError?.statusCode ?? 409,
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
