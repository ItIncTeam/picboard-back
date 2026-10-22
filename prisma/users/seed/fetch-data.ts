/**
 * Standalone fetch+normalize: GeoNames → prisma/users/seed/data/{countries,cities}.json (ru+en).
 *
 * Запуск (из корня репо):
 *   npx dotenv -e apps/users-microservice/src/env/.env.development.local -- ts-node --transpile-only prisma/users/seed/fetch-data.ts
 */
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import AdmZip from 'adm-zip';
import unzipper from 'unzipper';

const dataDir = path.resolve('prisma/users/seed/data');
const cacheDir = path.resolve('prisma/users/seed/.cache');

const CITIES_ZIP = 'https://download.geonames.org/export/dump/cities15000.zip';
const COUNTRY_INFO =
  'https://download.geonames.org/export/dump/countryInfo.txt';
const ALT_NAMES_ZIP =
  'https://download.geonames.org/export/dump/alternateNamesV2.zip';

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed ${url}: ${res.status}`);
  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(res.body as any)
      .pipe(fs.createWriteStream(dest))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function buildRuMap(cityIds: Set<number>): Promise<Map<number, string>> {
  const zipPath = path.join(cacheDir, 'alternateNamesV2.zip');
  if (!fs.existsSync(zipPath)) {
    console.log('downloading alternateNamesV2.zip (~180MB)...');
    await downloadToFile(ALT_NAMES_ZIP, zipPath);
  }
  const ru = new Map<number, string>();
  let found = false;
  await new Promise<void>((resolve, reject) => {
    const parser = unzipper.Parse();
    fs.createReadStream(zipPath).pipe(parser);
    parser.on('error', reject);
    // без этого промис висел бы вечно, если в архиве нет нужной entry
    parser.on('close', () => {
      if (!found) reject(new Error('alternateNamesV2.txt not found in zip'));
    });
    parser.on('entry', (entry: any) => {
      if (entry.path !== 'alternateNamesV2.txt') {
        entry.autodrain();
        return;
      }
      found = true;
      let buf = '';
      entry.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          // columns: [1]=geonameid [2]=isolanguage [3]=name [4]=isPreferredName
          const c = line.split('\t');
          if (c[2] === 'ru') {
            const gid = parseInt(c[1], 10);
            if (cityIds.has(gid) && (!ru.has(gid) || c[4] === '1')) {
              ru.set(gid, c[3]);
            }
          }
        }
      });
      entry.on('end', () => resolve());
      entry.on('error', reject);
    });
  });
  console.log(`ru names collected: ${ru.size}`);
  return ru;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  // 1. world-countries (ru) — также служит фильтром актуальных ISO-кодов
  const wcModule: any = await import('world-countries');
  const wcList: any[] = wcModule.default || wcModule;
  const wcByCode = new Map<string, any>(wcList.map((c) => [c.cca2, c]));

  // 2. countryInfo.txt → countries (только актуальные ISO)
  const countryInfoText = await (await fetch(COUNTRY_INFO)).text();
  const countries: { code: string; name: string; nameRu: string | null }[] = [];
  for (const line of countryInfoText.split('\n')) {
    if (line.startsWith('#')) continue;
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const code = cols[0];
    const name = cols[4];
    const wc = wcByCode.get(code);
    if (!wc) continue; // // отбрасываем obsolete (CS, AN, …)
    countries.push({
      code,
      name,
      nameRu: wc.translations?.rus?.common ?? null,
    });
  }

  // 3. cities15000.txt → города
  const citiesZip = await downloadBuffer(CITIES_ZIP);
  const zip = new AdmZip(citiesZip);
  const entry = zip.getEntries().find((e) => e.entryName === 'cities15000.txt');
  if (!entry) throw new Error('cities15000.txt not found in zip');
  const validCodes = new Set(countries.map((c) => c.code));

  const raw: {
    geonameId: number;
    name: string;
    countryCode: string;
    population: number | null;
    altRu: string | null;
  }[] = [];
  for (const line of entry.getData().toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 15) continue;
    const countryCode = cols[8];
    if (!validCodes.has(countryCode)) continue;
    let altRu: string | null = null;
    for (const alt of cols[3].split(',')) {
      if (/[А-Яа-яЁё]/.test(alt)) {
        altRu = alt;
        break;
      }
    }
    const population = Number.parseInt(cols[14], 10);
    raw.push({
      geonameId: Number.parseInt(cols[0], 10),
      name: cols[1],
      countryCode,
      population: Number.isNaN(population) ? null : population,
      altRu,
    });
  }
  console.log(`cities from cities15000: ${raw.length}`);

  // 4. alternateNamesV2 → ru по geonameId
  const ruMap = await buildRuMap(new Set(raw.map((c) => c.geonameId)));

  // 5. merge: ru из alternateNamesV2, иначе эвристика, иначе null
  const cities = raw.map((c) => ({
    geonameId: c.geonameId,
    name: c.name,
    nameRu: ruMap.get(c.geonameId) ?? c.altRu ?? null,
    countryCode: c.countryCode,
    population: c.population,
  }));

  fs.writeFileSync(
    path.join(dataDir, 'countries.json'),
    JSON.stringify(countries, null, 2),
  );
  fs.writeFileSync(
    path.join(dataDir, 'cities.json'),
    JSON.stringify(cities, null, 2),
  );

  const nullRu = cities.filter((c) => !c.nameRu).length;
  console.log(
    `Countries: ${countries.length} (null ru: ${countries.filter((c) => !c.nameRu).length})`,
  );
  console.log(
    `Cities: ${cities.length}, null ru: ${nullRu}, ru pct: ${Math.round(
      (100 * (cities.length - nullRu)) / cities.length,
    )}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
