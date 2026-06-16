import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SetNewPasswordPayload {
  @Field()
  message: string;
}
