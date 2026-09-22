import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

@InputType()
export class CompleteUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  fileId: string;
}
