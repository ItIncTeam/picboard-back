import {
  GeneratePresignedGetUrlInput,
  GeneratePresignedPutUrlInput,
} from './input.models';
import {
  GeneratePresignedGetUrlResult,
  GeneratePresignedPutUrlResult,
} from './output.models';
import { GetObjectMetadataInput, ReadObjectBytesInput } from './input.models';
import { ObjectMetadataResult } from './output.models';

export abstract class StorageService {
  abstract getBucketName(): string;

  abstract generatePresignedPutUrl(
    input: GeneratePresignedPutUrlInput,
  ): Promise<GeneratePresignedPutUrlResult>;

  abstract getObjectMetadata(
    input: GetObjectMetadataInput,
  ): Promise<ObjectMetadataResult | null>;

  // reads the first `length` bytes of the object; null if it doesn't exist
  abstract readObjectBytes(
    input: ReadObjectBytesInput,
  ): Promise<Uint8Array | null>;

  abstract generatePresignedGetUrl(
    input: GeneratePresignedGetUrlInput,
  ): Promise<GeneratePresignedGetUrlResult>;
}
