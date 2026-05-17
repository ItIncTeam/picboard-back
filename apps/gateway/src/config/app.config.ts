import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfig {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    const value = this.configService.get<string>('PORT');
    if (!value) throw new Error('PORT is not defined');
    return Number(value);
  }

  get usersGqlUrl(): string {
    const value = this.configService.get<string>('USERS_GQL_URL');
    if (!value) throw new Error('USERS_GQL_URL is not defined');
    return value;
  }

  get postsGqlUrl(): string {
    const value = this.configService.get<string>('POSTS_GQL_URL');
    if (!value) throw new Error('POSTS_GQL_URL is not defined');
    return value;
  }

  get filesGqlUrl(): string {
    const value = this.configService.get<string>('FILES_GQL_URL');
    if (!value) throw new Error('FILES_GQL_URL is not defined');
    return value;
  }
}
