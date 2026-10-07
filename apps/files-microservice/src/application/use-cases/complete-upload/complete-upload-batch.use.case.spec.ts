import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  CompleteUploadBatchCommand,
  CompleteUploadBatchUseCase,
} from './complete-upload-batch.use.case';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { StorageService } from '../../../domain/services/awsS3Storage/storage.service';
import { FileEntity } from '../../../domain/entities/file.entity';
import { Purpose } from '../../../domain/enums/file-purpose.enum';
import { Mime } from '../../../domain/enums/file-mime';
import { FileStatus } from '../../../domain/enums/file-status.enum';

const OWNER_ID = 'user-1';
const FILE_ID = 'file-1';
const STORAGE_KEY = 'avatar/user-1/2026/10/file-1.png';
const SIZE = 5 * 1024 * 1024;
const AVATAR_MESSAGE =
  'The photo must be less than 10 Mb and have JPEG or PNG format';

const PNG_HEAD = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_HEAD = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
]);
// "GIF89a"
const GIF_HEAD = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
]);

// a PENDING file declared as PNG
const pendingFile = (purpose: Purpose) =>
  new FileEntity(
    FILE_ID,
    OWNER_ID,
    'me.png',
    purpose,
    Mime.PNG,
    SIZE,
    FileStatus.PENDING,
    new Date(),
    STORAGE_KEY,
    'test-bucket',
    1,
    null,
  );

describe('CompleteUploadBatchUseCase', () => {
  let useCase: CompleteUploadBatchUseCase;
  let filesRepository: jest.Mocked<FilesRepository>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(async () => {
    // the use case logs every rejection; keep the test output readable
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    filesRepository = {
      findByIdsOwnerAndStatus: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<FilesRepository>;

    storageService = {
      getBucketName: jest.fn(),
      generatePresignedPutUrl: jest.fn(),
      // what S3 reports when the client uploaded what it declared
      getObjectMetadata: jest.fn().mockResolvedValue({
        key: STORAGE_KEY,
        size: SIZE,
        mimeType: 'image/png',
        lastModified: new Date(),
        eTag: '',
        checksum: '',
      }),
      readObjectBytes: jest.fn(),
      generatePresignedGetUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteUploadBatchUseCase,
        { provide: FilesRepository, useValue: filesRepository },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    useCase = module.get(CompleteUploadBatchUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const complete = (purpose: Purpose) => {
    filesRepository.findByIdsOwnerAndStatus.mockResolvedValue([
      pendingFile(purpose),
    ]);

    return useCase.execute(new CompleteUploadBatchCommand([FILE_ID], OWNER_ID));
  };

  describe('AVATAR', () => {
    it('should mark the file READY when its bytes are the declared type', async () => {
      storageService.readObjectBytes.mockResolvedValue(PNG_HEAD);

      const result = await complete(Purpose.AVATAR);

      expect(result).toEqual([
        { fileId: FILE_ID, status: FileStatus.READY, retryable: false },
      ]);
      expect(storageService.readObjectBytes).toHaveBeenCalledWith({
        key: STORAGE_KEY,
        length: 8,
      });
      expect(filesRepository.updateStatus).toHaveBeenCalledWith(
        FILE_ID,
        FileStatus.READY,
        undefined,
        expect.any(Date),
      );
    });

    it.each([
      ['a GIF', GIF_HEAD, 'unknown'],
      ['a JPEG', JPEG_HEAD, 'JPEG'],
    ])(
      'should fail a file declared PNG whose bytes are %s',
      async (_, head, actual) => {
        storageService.readObjectBytes.mockResolvedValue(head);

        const result = await complete(Purpose.AVATAR);

        // the client gets the spec message...
        expect(result).toEqual([
          {
            fileId: FILE_ID,
            status: FileStatus.FAILED,
            failedReason: AVATAR_MESSAGE,
            retryable: false,
          },
        ]);
        // ...the DB keeps the detail
        expect(filesRepository.updateStatus).toHaveBeenCalledWith(
          FILE_ID,
          FileStatus.FAILED,
          `Content mismatch: declared PNG, actual ${actual}`,
        );
      },
    );

    it('should fail the file when its bytes cannot be read', async () => {
      storageService.readObjectBytes.mockResolvedValue(null);

      const result = await complete(Purpose.AVATAR);

      expect(result).toEqual([
        {
          fileId: FILE_ID,
          status: FileStatus.FAILED,
          failedReason: AVATAR_MESSAGE,
          retryable: false,
        },
      ]);
      expect(filesRepository.updateStatus).toHaveBeenCalledWith(
        FILE_ID,
        FileStatus.FAILED,
        'Content mismatch: declared PNG, actual unknown',
      );
    });

    it('should fail the file as retryable when S3 errors while reading', async () => {
      storageService.readObjectBytes.mockRejectedValue(new Error('S3 down'));

      const result = await complete(Purpose.AVATAR);

      // the raw error is stored but never returned to the client
      expect(result).toEqual([
        {
          fileId: FILE_ID,
          status: FileStatus.FAILED,
          failedReason: 'Upload verification failed',
          retryable: true,
        },
      ]);
      expect(filesRepository.updateStatus).toHaveBeenCalledWith(
        FILE_ID,
        FileStatus.FAILED,
        'S3 down',
      );
    });

    it('should not read the bytes when the size already mismatches', async () => {
      storageService.getObjectMetadata.mockResolvedValue({
        key: STORAGE_KEY,
        size: SIZE + 1,
        mimeType: 'image/png',
        lastModified: new Date(),
        eTag: '',
        checksum: '',
      });

      const [result] = await complete(Purpose.AVATAR);

      expect(result.status).toBe(FileStatus.FAILED);
      expect(storageService.readObjectBytes).not.toHaveBeenCalled();
    });
  });

  describe('POST_IMAGE', () => {
    it('should mark the file READY without reading its bytes', async () => {
      const result = await complete(Purpose.POST_IMAGE);

      expect(result).toEqual([
        { fileId: FILE_ID, status: FileStatus.READY, retryable: false },
      ]);
      expect(storageService.readObjectBytes).not.toHaveBeenCalled();
    });
  });
});
