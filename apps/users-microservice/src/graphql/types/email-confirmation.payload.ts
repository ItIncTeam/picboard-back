import { Field, ObjectType } from '@nestjs/graphql';
import { UserOutput } from './user-output.type';

@ObjectType()
export class EmailConfirmationPayload {
  @Field(() => UserOutput)
  user: UserOutput;

  @Field()
  message: string;
}
