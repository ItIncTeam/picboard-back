import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(AppConfig);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [appConfig.rabbitMqUrl],
      queue: appConfig.rabbitMqQueue,
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();
  await app.listen(appConfig.port);
}
bootstrap();
