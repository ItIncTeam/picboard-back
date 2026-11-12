import { detectImageMime, IMAGE_SIGNATURE_LENGTH } from './detect-image-mime';
import { Mime } from '../../enums/file-mime';

const bytes = (...values: number[]) => new Uint8Array(values);

const JPEG_HEAD = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const PNG_HEAD = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
// "GIF89a"
const GIF_HEAD = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00);

describe('detectImageMime', () => {
  it('should detect JPEG', () => {
    expect(detectImageMime(JPEG_HEAD)).toBe(Mime.JPEG);
  });

  it('should detect PNG', () => {
    expect(detectImageMime(PNG_HEAD)).toBe(Mime.PNG);
  });

  it('should return null for GIF', () => {
    expect(detectImageMime(GIF_HEAD)).toBeNull();
  });

  it('should return null for text disguised as an image', () => {
    const html = new TextEncoder().encode('<html><body>');

    expect(detectImageMime(html)).toBeNull();
  });

  it('should return null when the buffer is shorter than the signature', () => {
    expect(detectImageMime(PNG_HEAD.subarray(0, 4))).toBeNull();
  });

  it('should return null for an empty buffer', () => {
    expect(detectImageMime(bytes())).toBeNull();
  });

  it('should need 8 bytes to tell the formats apart', () => {
    // the PNG signature is the longest
    expect(IMAGE_SIGNATURE_LENGTH).toBe(8);
  });
});
