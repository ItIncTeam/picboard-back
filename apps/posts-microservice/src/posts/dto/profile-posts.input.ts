import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { POST_RULES } from '../posts.constants';

@InputType()
export class ProfilePostsInput {
  @Field(() => ID)
  @IsString()
  userId: string;

  @Field(() => Int, {
    nullable: true,
    defaultValue: POST_RULES.PROFILE_POSTS_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(POST_RULES.PROFILE_POSTS_PAGE_SIZE)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string; // cursor — post.createdAt в ISO-строке
}
