import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PostAttachmentEntity {
  @Field(() => ID)
  fileId: string;

  @Field(() => Int)
  sortOrder: number;
}
