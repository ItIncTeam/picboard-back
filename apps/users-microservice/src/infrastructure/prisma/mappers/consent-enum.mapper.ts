import {
  LegalDocumentType as PrismaLegalDocumentType,
  ConsentAction as PrismaConsentAction,
} from '../../../../../../prisma/apps/users/src/generated/prisma/users-client';
import type { LegalDocumentType } from '../../../domain/enums/legal-document-type.enum';
import type { ConsentAction } from '../../../domain/enums/consent-action.enum';

export class ConsentEnumMapper {
  static toPrismaLegalDocumentType(
    value: LegalDocumentType,
  ): PrismaLegalDocumentType {
    switch (value) {
      case 'TERMS':
        return PrismaLegalDocumentType.TERMS;
      case 'PRIVACY':
        return PrismaLegalDocumentType.PRIVACY;
    }
  }

  static toPrismaConsentAction(value: ConsentAction): PrismaConsentAction {
    switch (value) {
      case 'ACCEPTED':
        return PrismaConsentAction.ACCEPTED;
      case 'WITHDRAWN':
        return PrismaConsentAction.WITHDRAWN;
    }
  }
}
