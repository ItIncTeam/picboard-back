import { Field, ObjectType } from '@nestjs/graphql';
import { FileStatus } from '../../domain/enums/file-status.enum';

@ObjectType()
export class CompleteUploadPayload {
  @Field()
  fileId: string;

  @Field(() => FileStatus)
  status: FileStatus;
}
