import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MinLength } from 'class-validator';

@InputType()
export class SignInInput {
  @Field()
  @IsEmail(
    {},
    { message: 'The email must match the format example@example.com' },
  )
  email: string;

  @Field()
  @MinLength(6)
  password: string;
}
