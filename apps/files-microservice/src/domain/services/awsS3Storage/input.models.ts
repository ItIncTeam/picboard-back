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

export type ReadObjectBytesInput = {
  key: string;
  // number of bytes to read from the start of the object
  length: number;
};

export interface GeneratePresignedGetUrlInput {
  storageKey: string;
  expiresInSeconds: number;
}
