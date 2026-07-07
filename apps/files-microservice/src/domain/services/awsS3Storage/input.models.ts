export type GeneratePresignedPutUrlInput = {
  key: string;
  mimeType: string;
  expiresInSeconds: number;
  size: number;
};

export type GetObjectMetadataInput = {
  bucket: string;
  key: string;
};

export interface GeneratePresignedGetUrlInput {
  storageKey: string;
  expiresInSeconds: number;
}
