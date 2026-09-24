import { ArgsType, Field, InputType, Int } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Purpose } from '../../domain/enums/file-purpose.enum';
import { Mime } from '../../domain/enums/file-mime';
import { UPLOAD_RULES } from '../../files/files.constants';

@InputType()
export class InitiateUploadInput {
  @Field()
  @IsNotEmpty()
  @IsUUID()
  clientUploadId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Matches(/^[^\\/:*?"<>|\r\n\t]+$/, {
    message: 'originalName contains invalid filename characters',
  })
  originalName: string;

  @Field(() => Purpose)
  @IsEnum(Purpose)
  purpose: Purpose;

  @Field(() => Mime)
  @IsEnum(Mime)
  mimeType: Mime;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(20_971_520) //20MB
  size: number;
}

// @ArgsType flattens into the schema, so the mutation signature stays
// initiateUploadBatch(input: [InitiateUploadInput!]!). The wrapper exists so the
// validation pipe has a class to work with: a bare array parameter reflects as
// `Array`, which ValidationPipe.toValidate() skips outright — leaving every
// decorator above unenforced, including the 20MB cap.
@ArgsType()
export class InitiateUploadArgs {
  @Field(() => [InitiateUploadInput])
  @ArrayMinSize(1)
  @ArrayMaxSize(UPLOAD_RULES.MAX_FILES_PER_BATCH)
  // without ValidateNested + Type the per-item rules above never run
  @ValidateNested({ each: true })
  @Type(() => InitiateUploadInput)
  input: InitiateUploadInput[];
}
