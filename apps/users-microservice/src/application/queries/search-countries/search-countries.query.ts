import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CountryRepository } from '../../../domain/repositories/country.repository';
import { CountryEntity } from '../../../domain/entities/country.entity';

export class SearchCountriesQuery {
  constructor(public readonly search?: string) {}
}

@QueryHandler(SearchCountriesQuery)
@Injectable()
export class SearchCountriesQueryHandler implements IQueryHandler<
  SearchCountriesQuery,
  CountryEntity[]
> {
  constructor(private readonly countryRepository: CountryRepository) {}

  execute(query: SearchCountriesQuery): Promise<CountryEntity[]> {
    return this.countryRepository.search(query.search?.trim() || undefined);
  }
}
