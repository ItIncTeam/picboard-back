import { CountryEntity } from '../entities/country.entity';

export abstract class CountryRepository {
  abstract search(search?: string): Promise<CountryEntity[]>;
  abstract findByIds(ids: string[]): Promise<CountryEntity[]>;
}
