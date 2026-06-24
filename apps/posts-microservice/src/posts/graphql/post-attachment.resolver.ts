import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PostAttachmentEntity } from '../entities/post-attachment.entity';

@Resolver(() => PostAttachmentEntity)
export class PostAttachmentResolver {
  @ResolveField(() => String, { name: 'file' })
  file(@Parent() attachment: PostAttachmentEntity) {
    return { __typename: 'File', id: attachment.fileId };
  }
}
