import {
  Args,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
  ObjectType,
  Field,
  Context,
} from '@nestjs/graphql';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '@app/auth';

@ObjectType()
class LoginPayload {
  @Field()
  accessToken: string;

  @Field(() => User)
  user: User;
}

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { nullable: true })
  user(@Args('id') id: string) {
    return this.usersService.findById(id);
  }

  @Mutation(() => User)
  register(@Args('input') input: RegisterInput) {
    return this.usersService.register(input);
  }

  @Mutation(() => LoginPayload)
  login(@Args('input') input: LoginInput) {
    return this.usersService.login(input);
  }

  @UseGuards(GqlJwtAuthGuard)
  @Query(() => User)
  async me(@Context() context: any) {
    const reqUser = context.req.user;
    if (!reqUser?.userId) {
      throw new UnauthorizedException();
    }
    return this.usersService.me(reqUser.userId);
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return this.usersService.findById(reference.id);
  }
}
