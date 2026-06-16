import { Injectable } from '@nestjs/common';
import { UsersPrismaService } from '../infrastructure/prisma/users-prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: UsersPrismaService,
    private readonly jwtService: JwtService,
    /*@Inject(USERS_RMQ_CLIENT)
    private readonly client: ClientProxy,*/
  ) {}

  /*sendSomething(data: any) {
    return this.client.emit('user.created', data);
  }*/

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async me(userId: string) {
    return this.findById(userId);
  }
}
