import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '@app/common';

@InputType()
export class OAuthExchangeCodeInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  code: string;
}
