import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { CountryRepository } from '../../domain/repositories/country.repository';
import { CityRepository } from '../../domain/repositories/city.repository';
import { CountryEntity } from '../../domain/entities/country.entity';
import { CityEntity } from '../../domain/entities/city.entity';

/**
 * `User` и `Me` отдают локацию одинаково, но `@ResolveField` привязывается к
 * конкретному `@ObjectType`, поэтому тело вынесено в общие функции: одна копия
 * логики, одни кэш-ключи (`countries`/`cities`) — DataLoader живёт в рамках
 * запроса, так что батчинг остаётся общим для обоих типов.
 */
export type LocationParent = {
  countryId?: string | null;
  cityId?: string | null;
};

export type DataloaderContext = {
  dataloaderFactory: DataloaderFactory;
};

export function resolveCountryField(
  parent: LocationParent,
  context: DataloaderContext,
  countryRepository: CountryRepository,
): Promise<CountryEntity | Error | null> {
  if (!parent.countryId) return Promise.resolve(null);

  const loader = context.dataloaderFactory.create<string, CountryEntity>(
    'countries',
    async (ids: string[]) => {
      const rows = await countryRepository.findByIds(ids);
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => map.get(id) ?? new Error('Country not found'));
    },
  );

  return loader.load(parent.countryId);
}

export function resolveCityField(
  parent: LocationParent,
  context: DataloaderContext,
  cityRepository: CityRepository,
): Promise<CityEntity | Error | null> {
  if (!parent.cityId) return Promise.resolve(null);

  const loader = context.dataloaderFactory.create<string, CityEntity>(
    'cities',
    async (ids: string[]) => {
      const rows = await cityRepository.findByIds(ids);
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => map.get(id) ?? new Error('City not found'));
    },
  );

  return loader.load(parent.cityId);
}
