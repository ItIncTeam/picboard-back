/**
 * Standalone seed: заливает Country/City из data/*.json в БД users.
 *
 * Идемпотентность: Country upsert-ится по натуральному ключу `code`, City — по
 * `geonameId`. Повторный прогон не создаёт дублей, не меняет id существующих
 * строк и не удаляет ничего — ссылки User.countryId / User.cityId остаются
 * валидными.
 *
 * Атомарность: весь прогон (страны + города + `--prune`) идёт одной интерактивной
 * транзакцией — при обрыве БД остаётся в исходном состоянии, частично
 * обновлённого справочника не бывает.
 *
 * `--prune` — единственный разрушительный режим (по умолчанию ВЫКЛЮЧЕН):
 * удаляет страны/города, которых нет в датасете. Помни: FK на User — это
 * ON DELETE SET NULL, т.е. у затронутых пользователей локация обнулится.
 *
 * Запуск (из корня репо):
 *   pnpm prisma:seed:users
 *   pnpm prisma:seed:users --prune   # осознанно, см. выше
 *
 * pnpm передаёт неизвестный ему флаг прямо в скрипт, поэтому `--prune` доезжает
 * до node без служебного `--`. Обе формы (`--prune` и `-- --prune`) рабочие:
 * служебный `--` отфильтровывается при разборе argv.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
} from '../../apps/users/src/generated/prisma/users-client';

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

const COUNTRY_BATCH = 100;
const CITY_BATCH = 5000;
const DELETE_BATCH = 5000;

// 34k строк батчами по 5000 на медленном диске идут дольше дефолтных 5 секунд
// интерактивной транзакции Prisma, поэтому таймауты подняты явно.
const TRANSACTION_TIMEOUT_MS = 600_000;
const TRANSACTION_MAX_WAIT_MS = 60_000;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL;
  if (!url) throw new Error('DATABASE_URL / DATABASE_DIRECT_URL is not set');

  // pnpm прокидывает аргументы как `-- --prune`, поэтому служебный `--` отбрасываем.
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const prune = args.includes('--prune');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Страны — upsert по натуральному ключу `code`.
        let countriesDone = 0;
        for (const batch of chunk(countries, COUNTRY_BATCH)) {
          for (const country of batch) {
            await tx.country.upsert({
              where: { code: country.code },
              update: { name: country.name, nameRu: country.nameRu },
              create: {
                code: country.code,
                name: country.name,
                nameRu: country.nameRu,
              },
            });
          }
          countriesDone += batch.length;
          console.log(
            `countries upserted: ${countriesDone}/${countries.length}`,
          );
        }

        const dbCountries = await tx.country.findMany({
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

        const skipped = cities.length - cityData.length;
        if (skipped > 0) {
          console.warn(
            `warn: skipped ${skipped} cities — countryCode отсутствует в countries.json`,
          );
        }

        // 2. Города — батч-UPSERT по `geonameId`. id генерим в JS: колонка uuid
        // NOT NULL без DB-default (дефолт задан только на стороне Prisma), а при
        // конфликте присланный id игнорируется и строка сохраняет свой.
        let citiesDone = 0;
        for (const batch of chunk(cityData, CITY_BATCH)) {
          const rows = batch.map(
            (c) => Prisma.sql`(
              ${randomUUID()}::uuid,
              ${c.countryId}::uuid,
              ${c.name},
              ${c.nameRu},
              ${c.population},
              ${c.geonameId}
            )`,
          );

          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO cities (id, "countryId", name, "nameRu", population, "geonameId")
              VALUES ${Prisma.join(rows)}
              ON CONFLICT ("geonameId") DO UPDATE
              SET name = EXCLUDED.name,
                  "nameRu" = EXCLUDED."nameRu",
                  population = EXCLUDED.population,
                  "countryId" = EXCLUDED."countryId"
            `,
          );

          citiesDone += batch.length;
          console.log(`cities upserted: ${citiesDone}/${cityData.length}`);
        }

        // 3. Опциональная чистка строк вне датасета (только по флагу).
        if (prune) {
          const seedGeonameIds = new Set(cityData.map((c) => c.geonameId));
          const dbCities = await tx.city.findMany({
            select: { geonameId: true },
          });
          const staleGeonameIds = dbCities
            .map((c) => c.geonameId)
            .filter((id) => !seedGeonameIds.has(id));

          for (const batch of chunk(staleGeonameIds, DELETE_BATCH)) {
            await tx.city.deleteMany({ where: { geonameId: { in: batch } } });
          }

          const seedCodes = new Set(countries.map((c) => c.code));
          const dbCountryCodes = await tx.country.findMany({
            select: { code: true },
          });
          const staleCodes = dbCountryCodes
            .map((c) => c.code)
            .filter((code) => !seedCodes.has(code));

          for (const batch of chunk(staleCodes, DELETE_BATCH)) {
            await tx.country.deleteMany({ where: { code: { in: batch } } });
          }

          console.log(
            `prune: removed cities=${staleGeonameIds.length} countries=${staleCodes.length}`,
          );
        } else {
          console.log(
            'prune: skipped (строки вне датасета не удаляются, для чистки запусти с --prune)',
          );
        }

        const countryCount = await tx.country.count();
        const cityCount = await tx.city.count();
        console.log(`DONE countries=${countryCount} cities=${cityCount}`);
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
