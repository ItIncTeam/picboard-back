/**
 * Standalone seed: заливает Country/City из data/*.json в БД users.
 * Полный rebuild: очищает Country (каскадом — City) и заливает заново.
 * Запуск (из корня репо):
 *   npx dotenv -e apps/users-microservice/src/env/.env.development.local -- ts-node --transpile-only prisma/users/seed/index.ts
 */
import fs from 'fs';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/users/src/generated/prisma/users-client';

type CountrySeed = { code: string; name: string; nameRu: string | null };
type CitySeed = {
  geonameId: number;
  name: string;
  nameRu: string | null;
  countryCode: string;
  population: number | null;
};

const dataDir = path.join(__dirname, 'data');
const countries: CountrySeed[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'countries.json'), 'utf8'),
);
const cities: CitySeed[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'),
);

const BATCH = 5000;

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL;
  if (!url) throw new Error('DATABASE_URL / DATABASE_DIRECT_URL is not set');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    // Полный rebuild: удаляем страны — каскадом уходят города (FK ON DELETE CASCADE).
    await prisma.country.deleteMany({});

    await prisma.country.createMany({
      data: countries.map((c) => ({
        code: c.code,
        name: c.name,
        nameRu: c.nameRu,
      })),
    });

    const dbCountries = await prisma.country.findMany({
      select: { id: true, code: true },
    });
    const codeToId = new Map(dbCountries.map((c) => [c.code, c.id]));

    const cityData = cities
      .map((c) => ({
        geonameId: c.geonameId,
        name: c.name,
        nameRu: c.nameRu,
        population: c.population,
        countryId: codeToId.get(c.countryCode) as string,
      }))
      .filter((c) => Boolean(c.countryId));

    for (let i = 0; i < cityData.length; i += BATCH) {
      await prisma.city.createMany({
        data: cityData.slice(i, i + BATCH),
      });
      console.log(
        `cities inserted: ${Math.min(i + BATCH, cityData.length)}/${cityData.length}`,
      );
    }

    const countryCount = await prisma.country.count();
    const cityCount = await prisma.city.count();
    console.log(`DONE countries=${countryCount} cities=${cityCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
