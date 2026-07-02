import { Field, ID, ObjectType, Directive, Int } from '@nestjs/graphql';
import { Purpose } from '../../domain/enums/file-purpose.enum';
import { FileStatus } from '../../domain/enums/file-status.enum';
import { Mime } from '../../domain/enums/file-mime';

@ObjectType()
@Directive('@key(fields: "id")')
export class File {
  @Field(() => ID)
  id: string;

  @Field()
  ownerId: string;

  @Field()
  originalName: string;

  @Field(() => Purpose)
  purpose: Purpose;

  @Field(() => Mime)
  mimeType: Mime;

  @Field(() => Int)
  size: number;

  @Field(() => FileStatus)
  status: FileStatus;

  storageKey: string; // Internal field - not exposed to gateway

  @Field()
  url?: string;
}
