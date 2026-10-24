import { Field, ObjectType } from '@nestjs/graphql';
import { FileStatus } from '../../../domain/enums/file-status.enum';

@ObjectType()
export class CompleteUploadPayload {
  @Field()
  fileId: string;

  @Field(() => FileStatus)
  status: FileStatus;

  // why the file failed; null when it succeeded
  @Field({ nullable: true })
  failedReason?: string;

  // whether retryUpload can help. False for a client-side mistake that would
  // fail identically on a second attempt — that file needs a fresh
  // initiateUploadBatch with corrected metadata instead.
  @Field()
  retryable: boolean;
}
