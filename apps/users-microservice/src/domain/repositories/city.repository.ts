import { CityEntity } from '../entities/city.entity';

export abstract class CityRepository {
  abstract search(
    countryId: string,
    search?: string,
    limit?: number,
  ): Promise<CityEntity[]>;
  abstract findByIds(ids: string[]): Promise<CityEntity[]>;
}
