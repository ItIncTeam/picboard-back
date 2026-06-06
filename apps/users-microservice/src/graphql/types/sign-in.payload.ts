import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.type';

@ObjectType()
export class SignInPayload {
  @Field(() => User)
  user: User;

  @Field()
  accessToken: string;
}
