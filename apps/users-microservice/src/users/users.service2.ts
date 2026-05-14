import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService2 {
  getHello(): string {
    return 'Hello World!';
  }
}
