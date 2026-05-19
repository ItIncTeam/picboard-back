import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MinLength } from 'class-validator';

@InputType()
export class GoogleInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(20)
  password: string;

  @Field()
  providerId: string;
}
