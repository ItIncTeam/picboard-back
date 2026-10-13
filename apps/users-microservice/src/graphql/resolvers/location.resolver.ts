import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Country } from '../types/country.type';
import { City } from '../types/city.type';
import { CountryRepository } from '../../domain/repositories/country.repository';
import { CityRepository } from '../../domain/repositories/city.repository';

@Resolver()
export class LocationResolver {
  constructor(
    private readonly countryRepository: CountryRepository,
    private readonly cityRepository: CityRepository,
  ) {}

  @Query(() => [Country])
  countries(@Args('search', { nullable: true }) search?: string) {
    return this.countryRepository.search(search);
  }

  @Query(() => [City])
  cities(
    @Args('countryId') countryId: string,
    @Args('search', { nullable: true }) search?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    const capped = Math.min(limit ?? 20, 50);
    return this.cityRepository.search(countryId, search, capped);
  }
}
