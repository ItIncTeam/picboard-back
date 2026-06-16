import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserOutput {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  isConfirmed: boolean;
}
