import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PostAttachmentEntity } from '../entities/post-attachment.entity';
import { FileReference } from '../entities/file-reference.entity';

@Resolver(() => PostAttachmentEntity)
export class PostAttachmentResolver {
  @ResolveField(() => FileReference /*String*/, { name: 'file' })
  file(@Parent() attachment: PostAttachmentEntity): FileReference {
    return { __typename: 'File', id: attachment.fileId } as FileReference;
  }
}
