import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class DeletePostInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  postId: string;
}
