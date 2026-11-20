export type FieldError = {
  field: string;
  message: string;
};

export type OriginalGraphQlError = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  errors?: FieldError[];
};

export type GraphqlApiErrorCode =
  | 'BAD_USER_INPUT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GRAPHQL_VALIDATION_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_SERVER_ERROR';

export type DomainErrorCode = string & {};

// Transport error codes that should NOT be treated as domain codes.
// On the second formatError pass, if extensions.code is already a transport
// code, we preserve it and do NOT overwrite it with a domain code.
export const TRANSPORT_ERROR_CODES: ReadonlySet<string> = new Set([
  'BAD_USER_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GRAPHQL_VALIDATION_FAILED',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'INTERNAL_SERVER_ERROR',
]);

// These live under `extensions` rather than at the top level of the error.
// A GraphQLFormattedError only carries message/locations/path/extensions, so
// anything written elsewhere is dropped on serialization — which is what made
// the gateway's second formatError pass fall through to 500 for every subgraph
// error, however correctly the subgraph had classified it.
export type GraphqlApiErrorExtensions = {
  code: GraphqlApiErrorCode | DomainErrorCode;
  statusCode: number;
  errors: FieldError[] | null;
};
