import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ExchangeOAuthCodeInput {
  @Field()
  code: string;
}
