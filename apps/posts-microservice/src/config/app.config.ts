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

  get filesServiceUrl(): any {
    const value = this.configService.get<string>('FILES_SERVICE_URL');
    if (!value) {
      throw new Error('FILES_SERVICE_URL is not defined');
    }
    return value;
  }
}
