import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const userId = gqlContext.auth?.userId;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return userId;
  },
);
