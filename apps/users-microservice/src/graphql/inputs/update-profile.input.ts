import { Field, InputType, ID } from '@nestjs/graphql';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { Trim } from '@app/common/decorators/transform/trim';
import { USERNAME_REGEX } from './sign-up.input';

@InputType()
export class UpdateProfileInput {
  @Field()
  @Trim()
  @Matches(USERNAME_REGEX)
  @IsNotEmpty()
  username: string;

  @Field()
  @Trim()
  @Length(1, 50)
  @Matches(/^(?=.*\p{L})[\p{L} '-]+$/u, {
    message: 'Only letters, spaces, hyphens and apostrophes',
  })
  firstName: string;

  @Field()
  @Trim()
  @Length(1, 50)
  @Matches(/^(?=.*\p{L})[\p{L} '-]+$/u, {
    message: 'Only letters, spaces, hyphens and apostrophes',
  })
  lastName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
  dateOfBirth?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  countryId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  cityId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(0, 200)
  @Trim()
  aboutMe?: string | null;
}
