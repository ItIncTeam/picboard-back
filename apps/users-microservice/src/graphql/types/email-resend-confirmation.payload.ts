import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailResendConfirmationPayload {
  @Field()
  message: string;
}
