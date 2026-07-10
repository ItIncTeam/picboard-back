import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfig {
  constructor(private readonly configService: ConfigService) {}

  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`${key} is not defined`);
    return value;
  }

  get port(): number {
    return Number(this.required('PORT'));
  }

  get usersGqlUrl(): string {
    return this.required('USERS_GQL_URL');
  }

  get postsGqlUrl(): string {
    return this.required('POSTS_GQL_URL');
  }

  get filesGqlUrl(): string {
    return this.required('FILES_GQL_URL');
  }

  get jwtAccessSecret(): string {
    return this.required('JWT_ACCESS_SECRET');
  }

  get jwtAccessExpiresIn(): string {
    return this.required('JWT_ACCESS_EXPIRES_IN');
  }

  get usersSubgraphSecret(): string {
    return this.required('USERS_SUBGRAPH_SECRET');
  }

  get postsSubgraphSecret(): string {
    return this.required('POSTS_SUBGRAPH_SECRET');
  }

  get filesSubgraphSecret(): string {
    return this.required('FILES_SUBGRAPH_SECRET');
  }

  get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
