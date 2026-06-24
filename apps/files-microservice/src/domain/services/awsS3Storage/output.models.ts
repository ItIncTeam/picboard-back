export type GeneratePresignedPutUrlResult = {
  uploadUrl: string;
  expiresAt: Date;
};

/*export type ObjectMetadataResult = {
  ContentLength: number;
  ContentType: string | null;
  LastModified: Date;
};*/

export type ObjectMetadataResult = {
  key: string;
  size: number;
  mimeType: string;
  lastModified: Date;
  eTag: string;
  checksum: string;
};

export interface GeneratePresignedGetUrlResult {
  url: string;
  expiresAt: Date;
}
