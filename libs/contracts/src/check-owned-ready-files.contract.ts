import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const FILES_TCP_PATTERNS = {
  CHECK_OWNED_READY: { cmd: 'files.checkOwnedReady' },
  MARK_FILES_DELETED: { cmd: 'files.markDeleted' },
} as const;

// Same values as files-service's Purpose enum. Listed here because
// contracts can't import from apps.
export const FILE_PURPOSE_VALUES = ['POST_IMAGE', 'BILL', 'AVATAR'] as const;
export type FilePurposeValue = (typeof FILE_PURPOSE_VALUES)[number];

export class CheckOwnedReadyFilesDto {
  @IsString()
  ownerId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds: string[];

  // When set, a file is valid only if it also has this purpose
  @IsOptional()
  @IsIn(FILE_PURPOSE_VALUES)
  purpose?: FilePurposeValue;
}

export class CheckOwnedReadyFilesResponse {
  validFileIds: string[];
  invalidFileIds: string[];
}

export class SoftDeleteFilesInput {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds: string[];

  @IsString()
  ownerId: string;
}

export class SoftDeleteResponse {
  count: number;
}
