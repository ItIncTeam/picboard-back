import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '@app/common';

@InputType()
export class ResendEmailInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  @IsEmail()
  email: string;
}
