import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.type';
import { UserOutput } from './user-output.type';

@ObjectType()
export class SignInPayload {
  @Field(() => User)
  user: UserOutput;

  @Field()
  accessToken: string;
}
