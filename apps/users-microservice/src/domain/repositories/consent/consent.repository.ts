import { UserConsentEntity } from '../../entities/user-consent.entity';
import { CreateUserConsentData } from './create-user-consent-data.type';

export abstract class ConsentRepository {
  abstract createConsent(
    data: CreateUserConsentData,
  ): Promise<UserConsentEntity>;
}
