export const LegalDocumentType = {
  TERMS: 'TERMS',
  PRIVACY: 'PRIVACY',
} as const;

export type LegalDocumentType =
  (typeof LegalDocumentType)[keyof typeof LegalDocumentType];
