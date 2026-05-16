import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
/*import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { configValidationUtility } from './config-validation.utility';*/
/*//dimych
export enum Environments {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TESTING = 'testing',
}

@Injectable()
export class AppConfig {
  constructor(private configService: ConfigService) {
    configValidationUtility.validateConfig(this);
  }
  @IsNumber(
    {},
    {
      message: 'Set env variable PORT, example: 3000',
    },
  )
  port: number = Number(this.configService.get('PORT'));

  @IsNotEmpty({
    message: 'Set env variable DATABASE_URL',
  })
  databaseUrl: string = this.configService.get('DATABASE_URL');

  @IsNotEmpty({
    message: 'Set env variable DATABASE_DIRECT_URL',
  })
  databaseDirectUrl: string = this.configService.get('DATABASE_DIRECT_URL');

  @IsEnum(Environments, {
    message:
      'Set correct NODE_ENV value, available values: ' +
      configValidationUtility.getEnumValues(Environments).join(', '),
  })
  env: string = this.configService.get('NODE_ENV');

  /!*  @IsBoolean({
    message:
      'Set env variable IS_SWAGGER_ENABLED to enable/disable Swagger, example: true, available values: true, false',
  })
  isSwaggerEnabled: boolean = configValidationUtility.convertToBoolean(
    this.configService.get('IS_SWAGGER_ENABLED'),
  );*!/

  /!*@IsBoolean({
    message:
      'Set env variable INCLUDE_TESTING_MODULE to enable/disable Dangerous for production TestingModule, example: true, available values: true, false, 0, 1',
  })
  includeTestingModule: boolean = configValidationUtility.convertToBoolean(
    this.configService.get('INCLUDE_TESTING_MODULE'),
  );*!/
}*/

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
}
