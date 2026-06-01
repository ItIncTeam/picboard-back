import { LegalDocumentType } from '../enums/legal-document-type.enum';
import { ConsentAction } from '../enums/consent-action.enum';

export class UserConsentEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: LegalDocumentType,
    public readonly action: ConsentAction,
    public readonly createdAt: Date,
  ) {}
}
