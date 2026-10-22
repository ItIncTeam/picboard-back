import { Injectable } from '@nestjs/common';
import { CountryRepository } from '../../../domain/repositories/country.repository';
import { CountryEntity } from '../../../domain/entities/country.entity';
import { UsersPrismaService } from '../users-prisma.service';

@Injectable()
export class PrismaCountryRepository implements CountryRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async search(search?: string): Promise<CountryEntity[]> {
    const rows = await this.prisma.country.findMany({
      where: search
        ? {
            OR: [
              { name: { startsWith: search, mode: 'insensitive' } },
              { nameRu: { startsWith: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
    return rows.map((c) => new CountryEntity(c.id, c.code, c.name, c.nameRu));
  }

  async findByIds(ids: string[]): Promise<CountryEntity[]> {
    const rows = await this.prisma.country.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((c) => new CountryEntity(c.id, c.code, c.name, c.nameRu));
  }
}
