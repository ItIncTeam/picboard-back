import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class CreatePostInput {
  @Field()
  @IsString()
  @MinLength(1)
  authorId: string;

  @Field()
  @IsString()
  @MinLength(1)
  text: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  coverImageFileId?: string;
}
