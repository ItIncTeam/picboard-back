import { Mime } from '../../enums/file-mime';

// magic bytes each format starts with. The client controls the declared
// mimeType and the Content-Type header, but not these
const SIGNATURES: { mime: Mime; bytes: number[] }[] = [
  { mime: Mime.JPEG, bytes: [0xff, 0xd8, 0xff] },
  {
    mime: Mime.PNG,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

// longest signature, so callers know how many bytes to read
export const IMAGE_SIGNATURE_LENGTH = Math.max(
  ...SIGNATURES.map((signature) => signature.bytes.length),
);

// returns null for anything that isn't a known image format, including a
// buffer too short to hold a whole signature
export function detectImageMime(bytes: Uint8Array): Mime | null {
  const match = SIGNATURES.find(({ bytes: signature }) =>
    signature.every((byte, index) => bytes[index] === byte),
  );

  return match?.mime ?? null;
}
