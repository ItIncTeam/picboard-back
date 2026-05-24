import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersPrismaService } from '../infrastructure/prisma/users-prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { USERS_RMQ_CLIENT } from './users.constants';
import { SignInInput } from '../graphql/inputs/sign-in.input';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: UsersPrismaService,
    private readonly jwtService: JwtService,
    @Inject(USERS_RMQ_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  sendSomething(data: any) {
    return this.client.emit('user.created', data);
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async login(input: SignInInput) {
    const user = await this.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(input.password, '123456');

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      accessToken,
      user,
    };
  }

  async me(userId: string) {
    return this.findById(userId);
  }
}
