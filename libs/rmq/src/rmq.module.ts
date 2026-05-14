import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RmqService } from './rmq.service';

export const RMQ_SERVICE = 'RMQ_SERVICE';

@Module({})
export class RmqModule {
  static register(): DynamicModule {
    return {
      module: RmqModule,
      imports: [
        ClientsModule.register([
          {
            name: RMQ_SERVICE,
            transport: Transport.RMQ,
            options: {
              urls: [
                process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
              ],
              queue: process.env.RABBITMQ_QUEUE || 'default_queue',
              queueOptions: { durable: true },
            },
          },
        ]),
      ],
      providers: [RmqService],
      exports: [ClientsModule, RmqService],
    };
  }
}
