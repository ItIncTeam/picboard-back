import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfig } from '../config/app.config';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateLimitRecord>();

  constructor(private readonly appConfig: AppConfig) {}

  use(req: Request, res: Response, next: NextFunction) {
    // console.log(`[RateLimit] ${req.method} ${req.path} ip=${req.ip}`);
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    let record = this.store.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + this.appConfig.rateLimitTtl };
      this.store.set(key, record);
      return next();
    }

    record.count++;

    if (record.count > this.appConfig.rateLimitMax) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        statusCode: 429,
        message: 'Too Many Requests',
      });
    }

    return next();
  }
}
