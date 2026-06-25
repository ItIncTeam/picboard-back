import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RemoteGraphQLDataSource } from '@apollo/gateway';

@Injectable()
export class CookieForwardingDataSource extends RemoteGraphQLDataSource {
  constructor(
    private readonly jwtService: JwtService,
    options: { url: string },
  ) {
    super(options);
  }

  override async willSendRequest({
    request,
    context,
  }: {
    request: any;
    context: any;
  }) {
    // Validate JWT and extract userId
    const authHeader = context.req?.headers?.authorization;

    if (authHeader) {
      const token = authHeader.split(' ')[1]; // Remove 'Bearer '

      try {
        const payload = this.jwtService.verify(token);
        // Forward userId to all subgraphs
        request.http?.headers.set('authorization', authHeader);
        request.http?.headers.set(
          'x-user-id',
          String(payload.userId ?? payload.sub) /*payload.userId*/,
        );
      } catch /*(error)*/ {
        throw new UnauthorizedException('Invalid or expired token');
      }
    } /*else {
      throw new UnauthorizedException('No authorization header');
    }*/

    /*// Forward authorization header (existing logic)
    if (authHeader) {
      request.http?.headers.set('authorization', authHeader);
    }*/

    // Forward cookies from the client to the subgraph
    const cookie = context.req?.headers?.cookie;
    if (cookie) {
      request.http?.headers.set('cookie', cookie);
    }
  }

  override didReceiveResponse({
    response,
    context,
  }: {
    response: any;
    context: any;
  }) {
    // Forward Set-Cookie from the subgraph back to the client
    const setCookie = response.http?.headers?.get('set-cookie');
    if (setCookie && context.res) {
      context.res.setHeader('set-cookie', setCookie);
    }
    return response;
  }
}

/*
@Injectable()
export class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async willSendRequest({ request, context }) {
    const authHeader = context.req.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.split(' ');
    [1];

    try {
      const payload = this.jwtService.verify(token);
      request.http.headers.set('x-user-id', payload.userId);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
*/
