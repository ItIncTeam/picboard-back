import { Purpose } from '../../enums/file-purpose.enum';
import { FileStatus } from '../../enums/file-status.enum';
import { Mime } from '../../enums/file-mime';

export type CreatePendingFileData = {
  id: string;
  ownerId: string;
  originalName: string;
  purpose: Purpose;
  mimeType: Mime;
  size: number;
  storageKey: string;
  bucket: string;
  status: FileStatus.PENDING;
};
