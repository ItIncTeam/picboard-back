import {
  Inject,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { SubgraphAuthOptions } from '@app/common/subgraph-auth/sungraph-auth.constants';
import { SUBGRAPH_AUTH_OPTIONS } from '@app/common/subgraph-auth/sungraph-auth.constants';

//This middleware is the critical protection that blocks direct public requests from calling a subgraph successfully.
@Injectable()
export class SubgraphGatewayAuthMiddleware implements NestMiddleware {
  constructor(
    /*private readonly secret: string */ @Inject(SUBGRAPH_AUTH_OPTIONS)
    private readonly options: SubgraphAuthOptions,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const routerAuthorization = req.header('Router-Authorization');
    const expectedSecret = this.options.secret;

    if (!expectedSecret) {
      throw new Error('SUBGRAPH_ROUTER_SECRET is not configured');
    }

    if (routerAuthorization !== expectedSecret) {
      throw new UnauthorizedException('Invalid gateway authorization');
    }

    next();
  }
}
