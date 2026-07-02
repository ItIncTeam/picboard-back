import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InitiateUploadPayload {
  @Field()
  clientUploadId: string;

  @Field()
  fileId: string;

  @Field()
  uploadUrl: string;

  @Field()
  expiresAt: Date;
}
