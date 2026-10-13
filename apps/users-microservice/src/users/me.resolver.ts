import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Me } from '../graphql/types/me.type';
import { FileReference } from '../graphql/types/file-reference.type';

@Resolver(() => Me)
export class MeResolver {
  @ResolveField(() => FileReference, { nullable: true })
  avatar(@Parent() me: Me): FileReference | null {
    if (!me.profilePictureFileId) return null;
    return { __typename: 'File', id: me.profilePictureFileId } as FileReference;
  }
}
