import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { createValidationPipe } from '@app/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(AppConfig);

  app.enableCors({
    origin: ['https://picboard.space', 'http://localhost:3000'],
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(createValidationPipe());

  
  /*app.connectMicroservice<MicroserviceOptions>({
    /!*transport: Transport.RMQ,
    options: {
      urls: [appConfig.rabbitMqUrl],
      queue: appConfig.rabbitMqQueue,
      queueOptions: { durable: true },
    },*!/
    transport: Transport.TCP,
    options: {
      host: appConfig.tcpHost,
      port: appConfig.tcpPort,
    },
  });*/

  await app.startAllMicroservices();
  await app.listen(appConfig.port, '0.0.0.0');
}
bootstrap();
