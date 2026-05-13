import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType()
export class CreateUploadSessionInput {
  @Field()
  @IsString()
  ownerId: string;

  @Field()
  @IsString()
  purpose: string;

  @Field()
  @IsString()
  mimeType: string;

  @Field(() => Int)
  @IsNumber()
  size: number;
}
