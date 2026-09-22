import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { FilesPrismaExceptionFilter } from './infrastructure/prisma/exception-filter/files-prisma-exception-filter';
import { createValidationPipe } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(AppConfig);

  app.useGlobalPipes(createValidationPipe());

  app.useGlobalFilters(new FilesPrismaExceptionFilter());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: appConfig.tcpPort,
    },
  });
  /*// RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [appConfig.rabbitMqUrl],
      queue: appConfig.rabbitMqQueue,
      queueOptions: { durable: true },
    },
  });*/

  await app.startAllMicroservices();
  await app.listen(appConfig.port, '0.0.0.0');
  /* The Nest app listens on all network interfaces inside the container, not just localhost, which is what you usually need for Docker/Kubernetes so the pod, service, and ingress can actually reach your app.
   app.listen(port, '0.0.0.0') for public HTTP inside Docker/Kubernetes.
   connectMicroservice({ transport: Transport.TCP, options: { host: '0.0.0.0', port } }) for internal TCP listeners that other services must reach. */
}
bootstrap();
