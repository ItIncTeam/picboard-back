import { Controller, Get } from '@nestjs/common';
import { UsersService2 } from './users.service2';

@Controller()
export class UsersMicroserviceController {
  constructor(private readonly usersMicroserviceService: UsersService2) {}

  @Get()
  getHello(): string {
    return this.usersMicroserviceService.getHello();
  }
}
