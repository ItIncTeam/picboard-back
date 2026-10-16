import { Purpose } from '../domain/enums/file-purpose.enum';
import { Mime } from '../domain/enums/file-mime';

/* //RabbitMQ
export const FILES_RMQ_CLIENT = 'FILES_RMQ_CLIENT';*/

export const UPLOAD_RULES = {
  // absolute cap for any batch. completeUpload and retryUpload only receive
  // fileIds, so their DTOs can't see the purpose and rely on this instead
  MAX_FILES_PER_BATCH: 10,
  MAX_UPLOAD_ATTEMPTS: 5,
} as const;

const MB = 1024 * 1024;

export type PurposeUploadRule = {
  allowedMimeTypes: readonly Mime[];
  maxSizeBytes: number;
  // a batch containing this purpose may hold at most this many files
  maxFilesPerBatch: number;
  // on completeUpload, read the first bytes from storage and check they
  // match the declared mimeType instead of trusting the client
  verifyContent: boolean;
  // returned to the client when a file breaks one of the rules above
  errorMessage: string;
};

export const PURPOSE_UPLOAD_RULES: Record<Purpose, PurposeUploadRule> = {
  [Purpose.POST_IMAGE]: {
    allowedMimeTypes: [Mime.JPEG, Mime.PNG],
    maxSizeBytes: 20 * MB,
    maxFilesPerBatch: 10,
    verifyContent: false,
    errorMessage: 'Post images must be JPEG or PNG and at most 20 MB',
  },
  [Purpose.BILL]: {
    allowedMimeTypes: [Mime.JPEG, Mime.PNG],
    maxSizeBytes: 20 * MB,
    maxFilesPerBatch: 10,
    verifyContent: false,
    errorMessage: 'Bills must be JPEG or PNG and at most 20 MB',
  },
  [Purpose.AVATAR]: {
    allowedMimeTypes: [Mime.JPEG, Mime.PNG],
    maxSizeBytes: 10 * MB,
    maxFilesPerBatch: 1,
    verifyContent: true,
    errorMessage:
      'The photo must be less than 10 Mb and have JPEG or PNG format',
  },
};
