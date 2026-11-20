import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { createValidationPipe } from '@app/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(AppConfig);

  app.useGlobalPipes(createValidationPipe());


  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: [appConfig.rabbitMqUrl],
  //     queue: appConfig.rabbitMqQueue,
  //     queueOptions: { durable: true },
  //   },
  // });

  await app.startAllMicroservices();
  await app.listen(appConfig.port);
}
bootstrap();
