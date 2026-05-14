import { Test, TestingModule } from '@nestjs/testing';
import { UsersMicroserviceController } from './users-microservice.controller';
import { UsersService2 } from './users.service2';

describe('UsersMicroserviceController', () => {
  let usersMicroserviceController: UsersMicroserviceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersMicroserviceController],
      providers: [UsersService2],
    }).compile();

    usersMicroserviceController = app.get<UsersMicroserviceController>(
      UsersMicroserviceController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(usersMicroserviceController.getHello()).toBe('Hello World!');
    });
  });
});
