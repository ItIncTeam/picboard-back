import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(AppConfig);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());

  await app.listen(appConfig.port, '0.0.0.0');
}
bootstrap();
