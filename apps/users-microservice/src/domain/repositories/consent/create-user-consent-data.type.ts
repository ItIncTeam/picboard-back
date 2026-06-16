import { LegalDocumentType } from '../../enums/legal-document-type.enum';
import { ConsentAction } from '../../enums/consent-action.enum';

export type CreateUserConsentData = {
  userId: string;
  type: LegalDocumentType;
  action: ConsentAction;
};
