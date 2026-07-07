import { ArrayNotEmpty, IsArray, IsString, IsUUID } from 'class-validator';

export const FILES_TCP_PATTERNS = {
  CHECK_OWNED_READY: { cmd: 'files.checkOwnedReady' },
} as const;

export class CheckOwnedReadyFilesDto {
  @IsString()
  ownerId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds: string[];
}

export class CheckOwnedReadyFilesResponse {
  validFileIds: string[];
  invalidFileIds: string[];
}

export class SoftDeleteResponse {
  count: number;
}
