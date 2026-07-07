import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { FileReference } from './file-reference.entity';

@ObjectType()
export class PostAttachmentEntity {
  @Field(() => ID)
  fileId: string;

  @Field(() => Int)
  sortOrder: number;

  @Field(() => FileReference, { nullable: true })
  file: FileReference | null;
}
