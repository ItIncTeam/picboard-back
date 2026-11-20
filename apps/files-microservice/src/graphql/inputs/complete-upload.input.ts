import { ArgsType, Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UPLOAD_RULES } from '../../files/files.constants';

@InputType()
export class CompleteUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  fileId: string;
}

// @ArgsType flattens into the schema, so the mutation signature stays
// completeUpload(input: [CompleteUploadInput!]!). The wrapper exists so the
// validation pipe has a class to work with: a bare array parameter reflects as
// `Array`, which ValidationPipe.toValidate() skips outright — leaving every
// decorator above unenforced.
@ArgsType()
export class CompleteUploadArgs {
  @Field(() => [CompleteUploadInput])
  @ArrayMinSize(1)
  @ArrayMaxSize(UPLOAD_RULES.MAX_FILES_PER_BATCH)
  // without ValidateNested + Type the per-item @IsUUID above never runs
  @ValidateNested({ each: true })
  @Type(() => CompleteUploadInput)
  input: CompleteUploadInput[];
}
