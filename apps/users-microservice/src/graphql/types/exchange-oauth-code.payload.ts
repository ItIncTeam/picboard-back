import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ExchangeOAuthCodePayload {
  @Field()
  accessToken: string;
}
