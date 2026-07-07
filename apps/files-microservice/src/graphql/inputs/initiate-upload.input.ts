import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Purpose } from '../../domain/enums/file-purpose.enum';
import { Mime } from '../../domain/enums/file-mime';

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
