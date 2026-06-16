/*
import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export interface RmqModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  name: string;
  useFactory: (...args: any[]) => {
    url: string;
    queue: string;
  };
}

@Module({})
export class RmqModule {
  static registerAsync(options: RmqModuleAsyncOptions): DynamicModule {
    return {
      module: RmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: options.name,
            imports: options.imports ?? [],
            inject: options.inject ?? [],
            useFactory: (...args: any[]) => {
              const rmqOptions = options.useFactory(...args);

              return {
                transport: Transport.RMQ,
                options: {
                  urls: [rmqOptions.url],
                  queue: rmqOptions.queue,
                  queueOptions: {
                    durable: true,
                  },
                },
              };
            },
          },
        ]),
      ],
      /!*providers: [RmqService],*!/
      exports: [ClientsModule /!*, RmqService*!/],
    };
  }
}*/
