import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RmqService {
  constructor(@Inject('RMQ_SERVICE') private readonly client: ClientProxy) {}

  emit<T = any>(pattern: string, data: T) {
    return this.client.emit(pattern, data);
  }
}
