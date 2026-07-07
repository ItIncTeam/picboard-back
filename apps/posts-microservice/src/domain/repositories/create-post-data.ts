export interface CreatePostData {
  ownerId: string;
  description: string | null;
  fileIds: string[];
}
