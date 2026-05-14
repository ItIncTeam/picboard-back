export type FilePurpose = 'PROFILE_PICTURE' | 'POST_IMAGE';

export interface FileUploadCompletedEvent {
  fileId: string;
  ownerId: string;
  purpose: FilePurpose;
  url: string | null;
}
