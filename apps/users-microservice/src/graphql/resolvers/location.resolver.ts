import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { Country } from '../types/country.type';
import { City } from '../types/city.type';
import { SearchCountriesQuery } from '../../application/queries/search-countries/search-countries.query';
import {
  DEFAULT_CITIES_LIMIT,
  SearchCitiesQuery,
} from '../../application/queries/search-cities/search-cities.query';

@Resolver()
export class LocationResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @Query(() => [Country])
  countries(
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.queryBus.execute(new SearchCountriesQuery(search));
  }

  @Query(() => [City])
  cities(
    @Args('countryId', { type: () => ID }, new ParseUUIDPipe())
    countryId: string,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('limit', {
      type: () => Int,
      nullable: true,
      defaultValue: DEFAULT_CITIES_LIMIT,
    })
    limit?: number,
  ) {
    return this.queryBus.execute(
      new SearchCitiesQuery(countryId, search, limit),
    );
  }
}
