import { Field, ObjectType } from '@nestjs/graphql';
import { UserOutput } from './user-output.type';

@ObjectType()
export class SignInPayload {
  @Field(() => UserOutput)
  user: UserOutput;

  @Field()
  accessToken: string;
}
