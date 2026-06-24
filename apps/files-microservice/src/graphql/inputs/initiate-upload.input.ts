import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString, Max, MaxLength } from 'class-validator';
import { Purpose } from '../../domain/enums/file-purpose.enum';
import { Mime } from '../../domain/enums/file-mime';

@InputType()
export class InitiateUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  clientUploadId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  originalName: string;

  @Field(() => Purpose)
  @IsEnum(Purpose)
  purpose: Purpose;

  @Field(() => Mime)
  @IsEnum(Mime)
  mimeType: Mime;

  @Field(() => Int)
  @Max(20_000_000_000) //20MB
  size: number;
}
