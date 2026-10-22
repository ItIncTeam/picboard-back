import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { CountryRepository } from '../../domain/repositories/country.repository';
import { CityRepository } from '../../domain/repositories/city.repository';
import { CountryEntity } from '../../domain/entities/country.entity';
import { CityEntity } from '../../domain/entities/city.entity';
import {
  DataloaderContext,
  resolveCityField,
  resolveCountryField,
} from './user-location.fields';

const GERMANY = new CountryEntity('country-de', 'DE', 'Germany', 'Германия');
const USA = new CountryEntity('country-us', 'US', 'United States', 'США');
const BERLIN = new CityEntity(
  'city-berlin',
  'Berlin',
  'Берлин',
  'country-de',
  3426354,
);
const MUNICH = new CityEntity(
  'city-munich',
  'Munich',
  'Мюнхен',
  'country-de',
  1260391,
);

function createCountryRepositoryMock(): jest.Mocked<CountryRepository> {
  return {
    search: jest.fn(),
    findByIds: jest.fn(),
  };
}

function createCityRepositoryMock(): jest.Mocked<CityRepository> {
  return {
    search: jest.fn(),
    findByIds: jest.fn(),
  };
}

describe('user location field resolvers', () => {
  let context: DataloaderContext;

  beforeEach(() => {
    // реальная фабрика — проверяем именно батчинг, а не мок
    context = { dataloaderFactory: new DataloaderFactory() };
  });

  describe('resolveCountryField', () => {
    it('returns null and skips the repository when countryId is missing', async () => {
      const countryRepository = createCountryRepositoryMock();

      await expect(
        resolveCountryField({}, context, countryRepository),
      ).resolves.toBeNull();
      expect(countryRepository.findByIds).not.toHaveBeenCalled();
    });

    it('batches all country lookups of one request into a single query', async () => {
      const countryRepository = createCountryRepositoryMock();
      countryRepository.findByIds.mockResolvedValue([GERMANY, USA]);

      const [first, second] = await Promise.all([
        resolveCountryField(
          { countryId: 'country-de' },
          context,
          countryRepository,
        ),
        resolveCountryField(
          { countryId: 'country-us' },
          context,
          countryRepository,
        ),
      ]);

      expect(countryRepository.findByIds).toHaveBeenCalledTimes(1);
      expect(countryRepository.findByIds).toHaveBeenCalledWith([
        'country-de',
        'country-us',
      ]);
      expect(first).toBe(GERMANY);
      expect(second).toBe(USA);
    });

    it('rejects only the missing key and keeps the rest of the batch', async () => {
      const countryRepository = createCountryRepositoryMock();
      countryRepository.findByIds.mockResolvedValue([GERMANY]);

      const [found, missing] = await Promise.all([
        resolveCountryField(
          { countryId: 'country-de' },
          context,
          countryRepository,
        ),
        resolveCountryField(
          { countryId: 'country-xx' },
          context,
          countryRepository,
        ).catch((error: unknown) => error),
      ]);

      expect(found).toBe(GERMANY);
      expect(missing).toBeInstanceOf(Error);
      expect((missing as Error).message).toBe('Country not found');
    });
  });

  describe('resolveCityField', () => {
    it('returns null and skips the repository when cityId is missing', async () => {
      const cityRepository = createCityRepositoryMock();

      await expect(
        resolveCityField({}, context, cityRepository),
      ).resolves.toBeNull();
      expect(cityRepository.findByIds).not.toHaveBeenCalled();
    });

    it('batches all city lookups of one request into a single query', async () => {
      const cityRepository = createCityRepositoryMock();
      cityRepository.findByIds.mockResolvedValue([BERLIN, MUNICH]);

      const [first, second] = await Promise.all([
        resolveCityField({ cityId: 'city-berlin' }, context, cityRepository),
        resolveCityField({ cityId: 'city-munich' }, context, cityRepository),
      ]);

      expect(cityRepository.findByIds).toHaveBeenCalledTimes(1);
      expect(cityRepository.findByIds).toHaveBeenCalledWith([
        'city-berlin',
        'city-munich',
      ]);
      expect(first).toBe(BERLIN);
      expect(second).toBe(MUNICH);
    });

    it('rejects only the missing key and keeps the rest of the batch', async () => {
      const cityRepository = createCityRepositoryMock();
      cityRepository.findByIds.mockResolvedValue([BERLIN]);

      const [found, missing] = await Promise.all([
        resolveCityField({ cityId: 'city-berlin' }, context, cityRepository),
        resolveCityField({ cityId: 'city-xx' }, context, cityRepository).catch(
          (error: unknown) => error,
        ),
      ]);

      expect(found).toBe(BERLIN);
      expect(missing).toBeInstanceOf(Error);
      expect((missing as Error).message).toBe('City not found');
    });
  });
});
