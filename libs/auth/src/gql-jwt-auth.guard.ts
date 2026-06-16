import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);

    return ctx.getContext().req;
  }

  /*//FOR DEBUGGING
  handleRequest(err: any, user: any, info: any) {
    console.log('JWT err:', err);
    console.log('JWT user:', user);
    console.log('JWT info:', info);

    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'Unauthorized');
    }

    return user;
  }*/
}
