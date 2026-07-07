import { Field, ID, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { POST_RULES } from '../../posts.constants';

@InputType()
export class CreatePostInput {
  @Field(() => [ID])
  @ArrayMinSize(1)
  @ArrayMaxSize(POST_RULES.MAX_FILES_PER_POST)
  fileIds: string[];

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(POST_RULES.MAX_DESCRIPTION_LENGTH)
  description?: string; //todo : обязательное поле?
}
