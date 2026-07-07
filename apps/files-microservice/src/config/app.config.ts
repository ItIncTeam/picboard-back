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

  get tcpPort(): number {
    const value = this.configService.get<string>('TCP_PORT');
    if (!value) throw new Error('TCP_PORT is not defined');
    return Number(value);
  }

  get rabbitMqUrl(): string {
    const value = this.configService.get<string>('RABBITMQ_URL');
    if (!value) throw new Error('RABBITMQ_URL is not defined');
    return value;
  }

  get rabbitMqQueue(): string {
    const value = this.configService.get<string>('RABBITMQ_QUEUE');
    if (!value) throw new Error('RABBITMQ_QUEUE is not defined');
    return value;
  }

  get databaseUrl(): string {
    const value = this.configService.get<string>('DATABASE_URL');
    if (!value) throw new Error('DATABASE_URL is not defined');
    return value;
  }

  get databaseDirectUrl(): string {
    const value = this.configService.get<string>('DATABASE_DIRECT_URL');
    if (!value) throw new Error('DATABASE_DIRECT_URL is not defined');
    return value;
  }

  get s3Bucket(): string {
    const value = this.configService.get<string>('S3_BUCKET_NAME');
    if (!value) throw new Error('S3_BUCKET_NAME is not defined');
    return value;
  }

  get s3AccessKeyId(): string {
    const value = this.configService.get<string>('S3_ACCESS_KEY_ID');
    if (!value) throw new Error('S3_ACCESS_KEY_ID is not defined');
    return value;
  }

  get s3SecretAccessKeyId(): string {
    const value = this.configService.get<string>('S3_SECRET_ACCESS_KEY_ID');
    if (!value) throw new Error('S3_SECRET_ACCESS_KEY_ID is not defined');
    return value;
  }

  get s3Endpoint(): string {
    const value = this.configService.get<string>('S3_ENDPOINT');
    if (!value) throw new Error('S3_ENDPOINT is not defined');
    return value;
  }

  get s3Region(): string {
    const value = this.configService.get<string>('S3_REGION');
    if (!value) throw new Error('S3_REGION is not defined');
    return value;
  }

  get s3UrlExpiresInSeconds(): number {
    const value = this.configService.get<string>('S3_URL_EXPIRES_IN_SECONDS');
    if (!value) throw new Error('S3_URL_EXPIRES_IN_SECONDS');
    return Number(value);
  }

  get jwtAccessSecret(): string {
    const value = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!value) throw new Error('JWT_ACCESS_SECRET is not defined');
    return value;
  }

  get jwtAccessExpiresIn(): any {
    const value = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    if (!value) {
      throw new Error('JWT_ACCESS_EXPIRES_IN is not defined');
    }
    return value;
  }

  get filesSubgraphSecret(): string {
    const value = this.configService.get<string>('FILES_SUBGRAPH_SECRET');
    if (!value) {
      throw new Error('FILES_SUBGRAPH_SECRET is not defined');
    }
    return value;
  }

  get nodeEnv(): string {
    const value = this.configService.get<string>('NODE_ENV');
    if (!value) {
      throw new Error('NODE_ENV is not defined');
    }
    return value;
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
