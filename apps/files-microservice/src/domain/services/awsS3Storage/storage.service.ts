import {
  GeneratePresignedGetUrlInput,
  GeneratePresignedPutUrlInput,
} from './input.models';
import {
  GeneratePresignedGetUrlResult,
  GeneratePresignedPutUrlResult,
} from './output.models';
import { GetObjectMetadataInput } from './input.models';
import { ObjectMetadataResult } from './output.models';

export abstract class StorageService {
  abstract getBucketName(): string;

  abstract generatePresignedPutUrl(
    input: GeneratePresignedPutUrlInput,
  ): Promise<GeneratePresignedPutUrlResult>;

  abstract getObjectMetadata(
    input: GetObjectMetadataInput,
  ): Promise<ObjectMetadataResult | null>;

  abstract generatePresignedGetUrl(
    input: GeneratePresignedGetUrlInput,
  ): Promise<GeneratePresignedGetUrlResult>;
}
