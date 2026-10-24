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
export class RetryUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  fileId: string;
}

// @ArgsType flattens into the schema, so the mutation signature stays
// retryUpload(input: [RetryUploadInput!]!). The wrapper exists only to give
// class-validator a property to hang the batch-size rules on — array
// decorators cannot be applied to a bare resolver parameter.
@ArgsType()
export class RetryUploadArgs {
  @Field(() => [RetryUploadInput])
  @ArrayMinSize(1)
  @ArrayMaxSize(UPLOAD_RULES.MAX_FILES_PER_BATCH)
  // without ValidateNested + Type the per-item @IsUUID above never runs
  @ValidateNested({ each: true })
  @Type(() => RetryUploadInput)
  input: RetryUploadInput[];
}
