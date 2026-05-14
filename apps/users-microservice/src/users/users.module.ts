import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { UsersPrismaService } from '../prisma/users-prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'super-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [UsersResolver, UsersService, UsersPrismaService],
  exports: [UsersService],
})
export class UsersModule {}
