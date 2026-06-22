import {
  Field,
  ID,
  Int,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { FileReference } from './file-reference.entity';

@ObjectType()
export class PostAttachmentEntity {
  @Field(() => ID)
  fileId: string;

  @Field(() => Int)
  sortOrder: number;
}

@Resolver(() => PostAttachmentEntity)
export class PostAttachmentResolver {
  @ResolveField(() => FileReference)
  file(@Parent() attachment: PostAttachmentEntity) {
    return { __typename: 'File', id: attachment.fileId };
  }
}
