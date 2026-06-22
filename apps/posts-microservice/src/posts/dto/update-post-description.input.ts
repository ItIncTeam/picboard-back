import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { POST_RULES } from '../posts.constants';

@InputType()
export class UpdatePostDescriptionInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  postId: string;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(POST_RULES.MAX_DESCRIPTION_LENGTH)
  description?: string;
}
