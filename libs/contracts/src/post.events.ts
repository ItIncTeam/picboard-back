export interface PostCreatedEvent {
  postId: string;
  authorId: string;
  coverImageFileId?: string | null;
  createdAt: string;
}
