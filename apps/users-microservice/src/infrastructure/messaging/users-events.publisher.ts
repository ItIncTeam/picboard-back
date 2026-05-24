/*import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { USERS_RMQ_CLIENT } from '../../users/users.constants';

@Injectable()
export class UsersEventsPublisher {
  constructor(
    @Inject(USERS_RMQ_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  async userSignedUp(event: {
    userId: string;
    email: string;
    username: string;
  }) {
    return this.client.emit('user.signed_up', event);
  }
}*/
