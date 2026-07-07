import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export type AuthContextPayload = {
  userId: string | null;
  role: string | null;
  sessionId: string | null;
};

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContextPayload => {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().auth;
  },
);
