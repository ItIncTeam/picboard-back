import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/*Here you only need one runtime value — the JWT secret — and ConfigService is already the standard Nest provider for reading validated config, so adding a custom app config module would be extra abstraction without much benefit.

Why ConfigService here
JwtStrategy is a low-level infrastructure class, and its constructor needs the secret immediately inside super(...), so injecting ConfigService directly is the simplest and most common Nest pattern. getOrThrow() is especially useful here because the app should fail fast on startup if JWT_ACCESS_SECRET is missing, rather than letting auth break later at runtime.

When a custom config module helps
A custom app config module becomes useful when you want grouped, typed, feature-specific config such as auth.secret, auth.expiresIn, mailer.host, or s3.bucket, especially if you want that config encapsulated per module. In other words, it helps when configuration itself becomes a domain of its own, not when you just need to read one env-backed value in one place.

Why not here
If you created a custom AppConfigService just so JwtStrategy could read JWT_ACCESS_SECRET, you would mostly be wrapping one ConfigService.getOrThrow() call in another method like appConfig.jwtAccessSecret. That adds one more provider and one more dependency path, but not much extra clarity unless your project already standardized around typed feature config objects.

Practical rule
So the rule we were following is:

Use ConfigService directly for small, straightforward infrastructure reads.

Use a custom config module/service when you need typed, grouped, reusable feature config across many files.

For this JwtStrategy, direct ConfigService is appropriate because it is simple, explicit, and fail-fast.*/

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: { sub: string; email: string; username: string }) {
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
