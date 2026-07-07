import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GqlContext } from '../graphql/normalize-context';

export interface AuthUser {
  userId: string;
  userRole?: string;
  sessionId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext<GqlContext>();
    const auth = gqlContext.auth;

    if (!auth.isAuthenticated) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      userId: auth.userId!,
      userRole: auth.userRole,
      sessionId: auth.sessionId,
    };
  },
);
