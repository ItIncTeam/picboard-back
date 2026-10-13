import { Injectable } from '@nestjs/common';
import { CityRepository } from '../../../domain/repositories/city.repository';
import { CityEntity } from '../../../domain/entities/city.entity';
import { UsersPrismaService } from '../users-prisma.service';

@Injectable()
export class PrismaCityRepository implements CityRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async search(
    countryId: string,
    search?: string,
    limit = 20,
  ): Promise<CityEntity[]> {
    const rows = await this.prisma.city.findMany({
      where: {
        countryId,
        ...(search
          ? {
              OR: [
                { name: { startsWith: search, mode: 'insensitive' } },
                { nameRu: { startsWith: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ population: 'desc' }, { name: 'asc' }],
      take: limit,
    });
    return rows.map(
      (c) => new CityEntity(c.id, c.name, c.nameRu, c.countryId, c.population),
    );
  }

  async findByIds(ids: string[]): Promise<CityEntity[]> {
    const rows = await this.prisma.city.findMany({
      where: { id: { in: ids } },
    });
    return rows.map(
      (c) => new CityEntity(c.id, c.name, c.nameRu, c.countryId, c.population),
    );
  }
}
