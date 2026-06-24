import { registerEnumType } from '@nestjs/graphql';

export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  READY = 'READY',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

registerEnumType(FileStatus, {
  name: 'FileStatus',
});
