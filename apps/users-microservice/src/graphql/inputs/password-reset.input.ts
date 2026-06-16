import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '@app/common';

@InputType()
export class PasswordResetInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  captchaToken: string;
}
