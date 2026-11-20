import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RetryUploadPayload {
  @Field()
  fileId: string;

  @Field()
  uploadUrl: string;

  @Field()
  expiresAt: Date;

  // attempt number this URL was issued for, so the client can show
  // how many tries are left before MAX_UPLOAD_ATTEMPTS is hit
  @Field(() => Int)
  attempt: number;
}
