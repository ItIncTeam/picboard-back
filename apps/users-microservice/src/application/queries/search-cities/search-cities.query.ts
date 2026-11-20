import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CityRepository } from '../../../domain/repositories/city.repository';
import { CityEntity } from '../../../domain/entities/city.entity';

export const DEFAULT_CITIES_LIMIT = 20;
export const MAX_CITIES_LIMIT = 50;

export class SearchCitiesQuery {
  public readonly limit: number;

  constructor(
    public readonly countryId: string,
    public readonly search?: string,
    limit?: number | null,
  ) {
    // Кэп и защита от 0/отрицательного/нечислового лимита живут здесь, а не в
    // резолвере: Prisma трактует take: -n как «последние n», т.е. молча отдаёт
    // не тот результат, а take: 0 — пустой список.
    const requested = Number.isFinite(limit)
      ? (limit as number)
      : DEFAULT_CITIES_LIMIT;

    this.limit = Math.max(1, Math.min(requested, MAX_CITIES_LIMIT));
  }
}

@QueryHandler(SearchCitiesQuery)
@Injectable()
export class SearchCitiesQueryHandler implements IQueryHandler<
  SearchCitiesQuery,
  CityEntity[]
> {
  constructor(private readonly cityRepository: CityRepository) {}

  execute(query: SearchCitiesQuery): Promise<CityEntity[]> {
    return this.cityRepository.search(
      query.countryId,
      query.search?.trim() || undefined,
      query.limit,
    );
  }
}
