import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RemoteGraphQLDataSource } from '@apollo/gateway';

//This datasource always authenticates the gateway to the subgraph, and only verifies a user token when one is actually present.
type GatewayReqHeaders = Record<string, string | string[] | undefined>;

type GatewayContext = {
  req?: {
    headers?: GatewayReqHeaders;
    ip?: string;
  };
  res?: {
    setHeader?: (name: string, value: string | string[]) => void;
  };
};

type JwtPayload = {
  sub?: string;
  userId?: string;
  role?: string;
  sessionId?: string;
};

@Injectable()
export class PicboardDataSource extends RemoteGraphQLDataSource {
  constructor(
    private readonly jwtService: JwtService,
    private readonly routerSecret: string,
    options: { url: string },
  ) {
    super(options);
  }

  override willSendRequest({
    request,
    context,
  }: {
    request: any;
    context: GatewayContext;
  }) {
    request.http?.headers.set('Router-Authorization', this.routerSecret);

    const rawAuthHeader = context?.req?.headers?.authorization;
    const authHeader = Array.isArray(rawAuthHeader)
      ? rawAuthHeader[0]
      : rawAuthHeader;

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, ''); // Remove 'Bearer '
      let payload: JwtPayload;

      try {
        payload = this.jwtService.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const userId = payload.userId ?? payload.sub;
      if (!userId) {
        throw new UnauthorizedException('Token payload is missing user id');
      }

      /*request.http?.headers.set('authorization', authHeader);*/
      request.http?.headers.set('x-user-id', String(userId));
      request.http?.headers.set('x-user-role', String(payload.role ?? 'user'));
      if (payload.sessionId) {
        request.http?.headers.set('x-session-id', String(payload.sessionId));
      }
    }

    // Forward cookies from the client to the subgraph
    const rawCookie = context?.req?.headers?.cookie;
    const cookie = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;

    if (cookie) {
      request.http?.headers.set('cookie', cookie);
    }

    const rawUserAgent = context?.req?.headers?.['user-agent'];
    const userAgent = Array.isArray(rawUserAgent)
      ? rawUserAgent[0]
      : rawUserAgent;

    if (userAgent) {
      request.http?.headers.set('x-client-user-agent', userAgent);
    }

    if (context?.req?.ip) {
      request.http?.headers.set('x-client-ip', context.req.ip);
    }

    /*const rawForwardedFor = context?.req?.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(rawForwardedFor)
      ? rawForwardedFor[0]
      : rawForwardedFor;

    if (forwardedFor) {
      request.http?.headers.set(
        'x-client-ip',
        forwardedFor.split(',')[0].trim(),
      );
    } else if (context?.req?.ip) {
      request.http?.headers.set('x-client-ip', context.req.ip);
    }*/
  }

  override didReceiveResponse({
    response,
    context,
  }: {
    response: any;
    context: GatewayContext;
  }) {
    // Forward Set-Cookie from the subgraph back to the client
    const setCookie = response.http?.headers?.get('set-cookie');

    if (setCookie && context.res?.setHeader) {
      context.res.setHeader('set-cookie', setCookie);
    }
    return response;
  }
}
