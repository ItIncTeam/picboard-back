export type FieldError = {
  field: string;
  message: string;
};

export type GraphqlApiError = {
  message: string;
  code:
    | 'BAD_USER_INPUT'
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'GRAPHQL_VALIDATION_FAILED'
    | 'INTERNAL_SERVER_ERROR';
  statusCode: number;
  errors: FieldError[] | null;
};
