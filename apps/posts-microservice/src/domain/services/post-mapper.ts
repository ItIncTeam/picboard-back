import { PostEntity } from '../../posts/entities/post.entity';
import { FileReference } from '../../posts/entities/file-reference.entity';
import { AttachmentRow, PostRow } from '../repositories/post-row.type';

export class PostMapper {
  static toEntity(raw: PostRow | null): PostEntity | null {
    if (!raw) return null;
    return {
      id: raw.id,
      ownerId: raw.ownerId,
      description: raw.description ?? undefined,
      attachments:
        raw.attachments?.map((a: AttachmentRow) => ({
          fileId: a.fileId,
          sortOrder: a.sortOrder,
          file: { __typename: 'File', id: a.fileId } as FileReference,
        })) ?? [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
  static toEntities(raws: PostRow[]): PostEntity[] {
    return raws.map((r) => this.toEntity(r)!);
  }
}
