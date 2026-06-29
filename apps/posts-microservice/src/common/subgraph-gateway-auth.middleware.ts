import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfig } from '../config/app.config';

@Injectable()
export class SubgraphGatewayAuthMiddleware implements NestMiddleware {
  constructor(private readonly appConfig: AppConfig) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const routerAuth = req.headers['router-authorization'];

    if (!routerAuth || routerAuth !== this.appConfig.routerSecret) {
      throw new UnauthorizedException('Invalid router authorization');
    }

    next();
  }
}
