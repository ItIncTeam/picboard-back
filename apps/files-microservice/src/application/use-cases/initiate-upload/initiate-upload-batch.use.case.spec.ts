import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  InitiateUploadBatchCommand,
  InitiateUploadBatchUseCase,
} from './initiate-upload-batch.use.case';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';
import { StorageKeyBuilder } from '../../../infrastructure/storage-key/storage-key-builder.service';
import { FileUploadPolicyService } from '../../../infrastructure/upload-policy/upload-policy.service';
import { AppConfig } from '../../../config/app.config';
import { InitiateUploadInput } from '../../../graphql/inputs/initiate-upload.input';
import { Purpose } from '../../../domain/enums/file-purpose.enum';
import { Mime } from '../../../domain/enums/file-mime';
import { FileStatus } from '../../../domain/enums/file-status.enum';

const MB = 1024 * 1024;
const OWNER_ID = 'user-1';
const CLIENT_UPLOAD_ID = '3f6c1b8e-2a4d-4c7e-9b1f-5d8a0e2c4b6a';
const STORAGE_KEY = 'avatar/user-1/2026/10/file-1.png';

const avatar = (overrides: Partial<InitiateUploadInput> = {}) =>
  Object.assign(new InitiateUploadInput(), {
    clientUploadId: CLIENT_UPLOAD_ID,
    originalName: 'me.png',
    purpose: Purpose.AVATAR,
    mimeType: Mime.PNG,
    size: 5 * MB,
    ...overrides,
  });

describe('InitiateUploadBatchUseCase', () => {
  let useCase: InitiateUploadBatchUseCase;
  let filesRepository: jest.Mocked<FilesRepository>;
  let storageService: jest.Mocked<StorageService>;
  let storageKeyBuilder: jest.Mocked<StorageKeyBuilder>;

  beforeEach(async () => {
    filesRepository = {
      createManyPending: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<FilesRepository>;

    storageService = {
      getBucketName: jest.fn().mockReturnValue('test-bucket'),
      generatePresignedPutUrl: jest.fn(),
      getObjectMetadata: jest.fn(),
      readObjectBytes: jest.fn(),
      generatePresignedGetUrl: jest.fn(),
    };

    storageKeyBuilder = {
      build: jest.fn().mockReturnValue(STORAGE_KEY),
    } as unknown as jest.Mocked<StorageKeyBuilder>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitiateUploadBatchUseCase,
        // the real policy: these tests check the use case applies it
        FileUploadPolicyService,
        { provide: FilesRepository, useValue: filesRepository },
        { provide: StorageService, useValue: storageService },
        { provide: StorageKeyBuilder, useValue: storageKeyBuilder },
        { provide: AppConfig, useValue: { s3UrlExpiresInSeconds: 300 } },
      ],
    }).compile();

    useCase = module.get(InitiateUploadBatchUseCase);
  });

  describe('rejected batch', () => {
    it.each([
      ['an avatar over 10 MB', [avatar({ size: 10 * MB + 1 })]],
      ['two avatars', [avatar(), avatar()]],
    ])('should reject %s without writing anything', async (_, items) => {
      await expect(
        useCase.execute(new InitiateUploadBatchCommand(items, OWNER_ID)),
      ).rejects.toThrow(BadRequestException);

      expect(filesRepository.createManyPending).not.toHaveBeenCalled();
      expect(storageService.generatePresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  describe('valid avatar', () => {
    it('should save it as PENDING and return its upload URL', async () => {
      const expiresAt = new Date('2026-10-07T12:00:00Z');
      storageService.generatePresignedPutUrl.mockResolvedValue({
        uploadUrl: 'https://s3.test/upload',
        expiresAt,
      });

      const result = await useCase.execute(
        new InitiateUploadBatchCommand([avatar()], OWNER_ID),
      );

      expect(filesRepository.createManyPending).toHaveBeenCalledWith([
        {
          id: expect.any(String),
          ownerId: OWNER_ID,
          originalName: 'me.png',
          purpose: Purpose.AVATAR,
          mimeType: Mime.PNG,
          size: 5 * MB,
          storageKey: STORAGE_KEY,
          bucket: 'test-bucket',
          status: FileStatus.PENDING,
        },
      ]);
      expect(storageService.generatePresignedPutUrl).toHaveBeenCalledWith({
        key: STORAGE_KEY,
        mimeType: Mime.PNG,
        expiresInSeconds: 300,
        size: 5 * MB,
      });

      // the id returned to the client is the one that was saved
      const [[savedItems]] = filesRepository.createManyPending.mock.calls;
      expect(result).toEqual([
        expect.objectContaining({
          clientUploadId: CLIENT_UPLOAD_ID,
          fileId: savedItems[0].id,
          uploadUrl: 'https://s3.test/upload',
          expiresAt,
        }),
      ]);
    });
  });
});
