import { Prisma } from '../../prisma/posts-prisma.service';

const postInclude = {
  attachments: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.PostInclude;

export type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;
export type AttachmentRow = PostRow['attachments'][number];
