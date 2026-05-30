import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Trim } from '@app/common';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_{|}~]+$/;

@InputType()
export class SetNewPasswordInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  code: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  @Length(6, 20)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must be 6-20 characters, contain at least one lowercase letter, one uppercase letter, and one number, and may include allowed special characters ! " # $ % & \' ( ) * + , - . ,. / : ; < = > ? @ [ \\ ] ^ _ { | } ~.',
  })
  password: string;
}
