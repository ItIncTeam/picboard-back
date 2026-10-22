import {
  DEFAULT_CITIES_LIMIT,
  MAX_CITIES_LIMIT,
  SearchCitiesQuery,
  SearchCitiesQueryHandler,
} from './search-cities.query';
import { CityRepository } from '../../../domain/repositories/city.repository';
import { CityEntity } from '../../../domain/entities/city.entity';

const COUNTRY_ID = '11111111-1111-4111-8111-111111111111';

function createCityRepositoryMock(): jest.Mocked<CityRepository> {
  return {
    search: jest.fn(),
    findByIds: jest.fn(),
  };
}

describe('SearchCitiesQuery', () => {
  describe('limit clamping', () => {
    it('defaults to 20 when limit is not provided', () => {
      expect(new SearchCitiesQuery(COUNTRY_ID).limit).toBe(
        DEFAULT_CITIES_LIMIT,
      );
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', null).limit).toBe(
        DEFAULT_CITIES_LIMIT,
      );
    });

    it('clamps to max 50', () => {
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', 100).limit).toBe(
        MAX_CITIES_LIMIT,
      );
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', 51).limit).toBe(
        MAX_CITIES_LIMIT,
      );
    });

    it('clamps to min 1 for 0 and negative limits', () => {
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', 0).limit).toBe(1);
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', -5).limit).toBe(1);
    });

    it('keeps a valid limit as is', () => {
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', 7).limit).toBe(7);
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', 50).limit).toBe(50);
    });

    it('falls back to the default for a non-finite limit', () => {
      expect(new SearchCitiesQuery(COUNTRY_ID, 'ber', NaN).limit).toBe(
        DEFAULT_CITIES_LIMIT,
      );
    });
  });
});

describe('SearchCitiesQueryHandler', () => {
  let cityRepository: jest.Mocked<CityRepository>;
  let handler: SearchCitiesQueryHandler;

  beforeEach(() => {
    cityRepository = createCityRepositoryMock();
    handler = new SearchCitiesQueryHandler(cityRepository);
  });

  it('passes countryId, search and clamped limit to the repository', async () => {
    const cities = [
      new CityEntity('city-1', 'Berlin', 'Берлин', COUNTRY_ID, 3426354),
    ];
    cityRepository.search.mockResolvedValue(cities);

    const result = await handler.execute(
      new SearchCitiesQuery(COUNTRY_ID, 'ber', 100),
    );

    expect(cityRepository.search).toHaveBeenCalledWith(
      COUNTRY_ID,
      'ber',
      MAX_CITIES_LIMIT,
    );
    expect(result).toBe(cities);
  });

  it('treats empty search as "no search"', async () => {
    cityRepository.search.mockResolvedValue([]);

    await handler.execute(new SearchCitiesQuery(COUNTRY_ID, ''));

    expect(cityRepository.search).toHaveBeenCalledWith(
      COUNTRY_ID,
      undefined,
      DEFAULT_CITIES_LIMIT,
    );
  });

  it('passes undefined search through for the default list', async () => {
    cityRepository.search.mockResolvedValue([]);

    await handler.execute(new SearchCitiesQuery(COUNTRY_ID));

    expect(cityRepository.search).toHaveBeenCalledWith(
      COUNTRY_ID,
      undefined,
      DEFAULT_CITIES_LIMIT,
    );
  });

  it('trims search and treats a blank string as "no search"', async () => {
    cityRepository.search.mockResolvedValue([]);

    await handler.execute(new SearchCitiesQuery(COUNTRY_ID, '  ber  '));
    await handler.execute(new SearchCitiesQuery(COUNTRY_ID, '   '));

    expect(cityRepository.search).toHaveBeenNthCalledWith(
      1,
      COUNTRY_ID,
      'ber',
      DEFAULT_CITIES_LIMIT,
    );
    expect(cityRepository.search).toHaveBeenNthCalledWith(
      2,
      COUNTRY_ID,
      undefined,
      DEFAULT_CITIES_LIMIT,
    );
  });
});
