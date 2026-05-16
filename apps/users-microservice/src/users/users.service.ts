import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterInput } from './dto/register.input';
import { UsersPrismaService } from '../prisma/users-prisma.service';
import { LoginInput } from './dto/login.input';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { USERS_RMQ_CLIENT } from './users.constants';

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

  async register(input: RegisterInput) {
    const existsByEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existsByEmail) {
      throw new BadRequestException('Email already in use');
    }

    const existsByUsername = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existsByUsername) {
      throw new BadRequestException('Username already in use');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
      },
    });
  }

  async login(input: LoginInput) {
    const user = await this.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);

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
