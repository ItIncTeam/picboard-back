import { BadRequestException } from '@nestjs/common';
import { FileUploadPolicyService } from './upload-policy.service';
import { InitiateUploadInput } from '../../graphql/inputs/initiate-upload.input';
import { Purpose } from '../../domain/enums/file-purpose.enum';
import { Mime } from '../../domain/enums/file-mime';

const MB = 1024 * 1024;
const AVATAR_MESSAGE =
  'The photo must be less than 10 Mb and have JPEG or PNG format';

const item = (
  overrides: Partial<InitiateUploadInput> = {},
): InitiateUploadInput =>
  Object.assign(new InitiateUploadInput(), {
    clientUploadId: '3f6c1b8e-2a4d-4c7e-9b1f-5d8a0e2c4b6a',
    originalName: 'photo.png',
    purpose: Purpose.POST_IMAGE,
    mimeType: Mime.PNG,
    size: 1 * MB,
    ...overrides,
  });

const items = (count: number, overrides: Partial<InitiateUploadInput> = {}) =>
  Array.from({ length: count }, () => item(overrides));

describe('FileUploadPolicyService', () => {
  let policy: FileUploadPolicyService;

  beforeEach(() => {
    policy = new FileUploadPolicyService();
  });

  // returns the body of the BadRequestException thrown by validateBatch
  const rejection = (batch: InitiateUploadInput[]) => {
    try {
      policy.validateBatch(batch);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return (error as BadRequestException).getResponse();
    }
    throw new Error('expected validateBatch to throw');
  };

  it('should reject an empty batch', () => {
    expect(rejection([])).toEqual({
      message: 'At least one file is required',
      errors: [{ field: 'input', message: 'At least one file is required' }],
    });
  });

  describe('AVATAR', () => {
    it.each([Mime.JPEG, Mime.PNG])('should accept a %s avatar', (mimeType) => {
      expect(() =>
        policy.validateBatch([item({ purpose: Purpose.AVATAR, mimeType })]),
      ).not.toThrow();
    });

    it('should accept an avatar of exactly 10 MB', () => {
      expect(() =>
        policy.validateBatch([
          item({ purpose: Purpose.AVATAR, size: 10 * MB }),
        ]),
      ).not.toThrow();
    });

    it('should reject an avatar 1 byte over 10 MB with the spec message', () => {
      expect(
        rejection([item({ purpose: Purpose.AVATAR, size: 10 * MB + 1 })]),
      ).toEqual({
        message: AVATAR_MESSAGE,
        errors: [{ field: 'input.0.size', message: AVATAR_MESSAGE }],
      });
    });

    it('should reject a MIME type the purpose does not allow', () => {
      // unreachable through GraphQL today (the MimeType enum only has
      // JPEG/PNG), but the policy must still enforce allowedMimeTypes
      expect(
        rejection([item({ purpose: Purpose.AVATAR, mimeType: 'GIF' as Mime })]),
      ).toEqual({
        message: AVATAR_MESSAGE,
        errors: [{ field: 'input.0.mimeType', message: AVATAR_MESSAGE }],
      });
    });

    it('should reject two avatars in one batch', () => {
      expect(rejection(items(2, { purpose: Purpose.AVATAR }))).toEqual({
        message: 'Only one file is allowed in this batch',
        errors: [
          { field: 'input', message: 'Only one file is allowed in this batch' },
        ],
      });
    });

    it('should reject an avatar batched with a post image', () => {
      const batch = [
        item({ purpose: Purpose.POST_IMAGE }),
        item({ purpose: Purpose.AVATAR }),
      ];

      expect(rejection(batch)).toMatchObject({
        message: 'Only one file is allowed in this batch',
      });
    });
  });

  // existing purposes must behave exactly as before AVATAR was added
  describe.each([Purpose.POST_IMAGE, Purpose.BILL])('%s', (purpose) => {
    it('should accept a file of exactly 20 MB', () => {
      expect(() =>
        policy.validateBatch([item({ purpose, size: 20 * MB })]),
      ).not.toThrow();
    });

    it('should reject a file 1 byte over 20 MB', () => {
      expect(rejection([item({ purpose, size: 20 * MB + 1 })])).toMatchObject({
        errors: [{ field: 'input.0.size' }],
      });
    });

    it('should accept 10 files', () => {
      expect(() => policy.validateBatch(items(10, { purpose }))).not.toThrow();
    });

    it('should reject 11 files', () => {
      expect(rejection(items(11, { purpose }))).toMatchObject({
        message: 'Maximum 10 files are allowed',
      });
    });

    it('should point the error at the failing item', () => {
      const batch = [
        item({ purpose }),
        item({ purpose }),
        item({ purpose, size: 20 * MB + 1 }),
      ];

      expect(rejection(batch)).toMatchObject({
        errors: [{ field: 'input.2.size' }],
      });
    });
  });
});
