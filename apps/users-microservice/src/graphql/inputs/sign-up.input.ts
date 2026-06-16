import { Field, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';
import { Trim } from '@app/common/decorators/transform/trim';

const PASSWORD_REGEX =
  /^(?=.{6,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_{|}~]+$/;
const USERNAME_REGEX = /^(?=.{6,30}$)[A-Za-z\d!_-]+$/;

@InputType()
export class SignUpInput {
  @Field()
  @IsEmail(
    {},
    { message: 'The email must match the format example@example.com' },
  )
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  // @Length(6, 30)
  @Matches(USERNAME_REGEX, {
    message:
      'Username must be 6-30 characters, may include lowercase and uppercase letters, and allowed special characters  - (hyphen) and  _ (underscore) ',
  })
  username: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @Trim()
  // @Length(6, 20)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must be 6-20 characters, contain at least one lowercase letter, one uppercase letter, and one number, and may include allowed special characters ! " # $ % & \' ( ) * + , - . ,. / : ; < = > ? @ [ \\ ] ^ _ { | } ~.',
  })
  password: string;

  @Field()
  @IsBoolean()
  acceptTerms: boolean;

  @Field()
  @IsBoolean()
  acceptPrivacy: boolean;

  /*@Field()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  termsVersion: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  privacyVersion: string;*/
}
