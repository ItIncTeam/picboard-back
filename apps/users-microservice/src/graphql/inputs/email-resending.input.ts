import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '@app/common';

@InputType()
export class RegistrationEmailResending {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  @IsEmail()
  /*@Matches(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)*/
  email: string;
}
