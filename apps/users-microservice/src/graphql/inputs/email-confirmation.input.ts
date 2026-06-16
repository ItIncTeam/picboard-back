import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '@app/common';

@InputType()
export class EmailConfirmationInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  code: string;
}
