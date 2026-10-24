import {
  SearchCountriesQuery,
  SearchCountriesQueryHandler,
} from './search-countries.query';
import { CountryRepository } from '../../../domain/repositories/country.repository';
import { CountryEntity } from '../../../domain/entities/country.entity';

function createCountryRepositoryMock(): jest.Mocked<CountryRepository> {
  return {
    search: jest.fn(),
    findByIds: jest.fn(),
  };
}

describe('SearchCountriesQueryHandler', () => {
  let countryRepository: jest.Mocked<CountryRepository>;
  let handler: SearchCountriesQueryHandler;

  beforeEach(() => {
    countryRepository = createCountryRepositoryMock();
    handler = new SearchCountriesQueryHandler(countryRepository);
  });

  it('passes search to the repository and returns its rows as is', async () => {
    const countries = [
      new CountryEntity('country-de', 'DE', 'Germany', 'Германия'),
    ];
    countryRepository.search.mockResolvedValue(countries);

    const result = await handler.execute(new SearchCountriesQuery('ger'));

    expect(countryRepository.search).toHaveBeenCalledWith('ger');
    expect(result).toBe(countries);
  });

  it('passes undefined when there is no search term (full list)', async () => {
    countryRepository.search.mockResolvedValue([]);

    await handler.execute(new SearchCountriesQuery());

    expect(countryRepository.search).toHaveBeenCalledWith(undefined);
  });

  it('trims search and treats a blank string as no search', async () => {
    countryRepository.search.mockResolvedValue([]);

    await handler.execute(new SearchCountriesQuery('  ger '));
    await handler.execute(new SearchCountriesQuery('   '));

    expect(countryRepository.search).toHaveBeenNthCalledWith(1, 'ger');
    expect(countryRepository.search).toHaveBeenNthCalledWith(2, undefined);
  });
});
