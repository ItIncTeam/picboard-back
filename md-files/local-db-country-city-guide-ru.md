# Локальная БД в Docker + справочник стран и городов

Практическая инструкция: как поднять локальный Postgres для всех трёх микросервисов,
накатить схему и засеять таблицы `countries` / `cities`, как это проверить и что делать,
если что-то пошло не так.

**Статус:** реализовано в PR #28 (ветка `city-country-select`) + доработка по ревью.
**Затрагивает:** `prisma/users`, `apps/users-microservice`, `docker-compose.db.yml`, README.

---

## 0. Что реализовано (карта функционала)

| Что                                              | Где                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Модели `Country`, `City` + поля профиля в `User` | `prisma/users/schema.prisma`, миграция `prisma/users/prisma/migrations/20261012125021_add_country_city_and_profile_fields/`        |
| Seed-скрипт (идемпотентный upsert)               | `prisma/users/seed/index.ts`, запуск — `pnpm prisma:seed:users`                                                                    |
| Датасет в git                                    | `prisma/users/seed/data/{countries,cities}.json`                                                                                   |
| Генератор датасета из GeoNames                   | `prisma/users/seed/fetch-data.ts`                                                                                                  |
| Лицензия/атрибуция                               | `prisma/users/seed/ATTRIBUTION.md`                                                                                                 |
| Публичные GraphQL-query                          | `apps/users-microservice/src/graphql/resolvers/location.resolver.ts`                                                               |
| CQRS-запросы (`QueryBus`)                        | `apps/users-microservice/src/application/queries/search-{countries,cities}/`                                                       |
| Репозитории                                      | `apps/users-microservice/src/infrastructure/prisma/repositories/prisma-{country,city}.repository.ts`                               |
| Поля `country`/`city` у `User` и `Me`            | `graphql/resolvers/users.resolver.ts`, `graphql/resolvers/me.resolver.ts`, общий код — `graphql/resolvers/user-location.fields.ts` |
| Docker Compose для локальной БД                  | `docker-compose.db.yml`, `docker/db/init/01-create-dbs.sql`                                                                        |
| Тесты                                            | `src/application/queries/**/*.spec.ts`, `src/graphql/resolvers/user-location.fields.spec.ts`, `test/app.e2e-spec.ts`               |

Что умеет справочник:

- страны — **250** записей (`code` ISO 3166-1 alpha-2, `name` en, `nameRu`);
- города — **34 160** записей (`geonameId`, `name` en, `nameRu`, `population`), из них ~44 % без русского названия;
- поиск по префиксу без учёта регистра по `name` **или** `nameRu`, города — в рамках выбранной страны, сортировка «крупные первыми».

---

## 1. Требования

- **Docker Desktop** (Windows/macOS) или Docker Engine + compose v2;
- **Node.js 20+**, **pnpm 10**;
- свободные порты: **5433** (Postgres наружу);
- ⚠️ порт **5432 обычно занят** локальным PostgreSQL (например, службой `postgresql-x64-18`) — поэтому контейнер публикуется на 5433. Внутри контейнера Postgres всегда слушает 5432.

Проверка:

```powershell
docker --version
docker compose version
node -v
pnpm -v
```

---

## 2. Шаг 1 — поднять Postgres

В корне репозитория:

```powershell
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.db.yml ps
```

Ожидаемо: контейнер `picboard-pg`, статус `running (healthy)`.

Что поднимается (см. `docker-compose.db.yml`):

| Параметр              | Значение                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| Образ                 | `postgres:17-alpine`                                                     |
| Контейнер             | `picboard-pg`                                                            |
| Порт                  | хост `5433` → контейнер `5432`                                           |
| Пользователь / пароль | `picboard` / `picboard`                                                  |
| Базы                  | `users_db` (создаёт образ), `posts_db`, `files_db` (создаёт init-скрипт) |
| Данные                | volume `picboard-db_pgdata`                                              |
| RabbitMQ              | **не поднимается** — сейчас не используется                              |

Проверить, что все три базы на месте:

```powershell
docker exec picboard-pg psql -U picboard -d users_db -c "select datname from pg_database where datname like '%_db';"
```

Ожидаемо три строки: `users_db`, `posts_db`, `files_db`.

> Init-скрипт `docker/db/init/01-create-dbs.sql` выполняется **только при первом создании
> тома**. Если поправить этот SQL на уже существующем томе — он не перезапустится,
> нужен `down -v` (см. §11).

### Подключение из pgAdmin / DBeaver

| Поле                 | Значение                |
| -------------------- | ----------------------- |
| Host                 | `localhost`             |
| Port                 | `5433`                  |
| Maintenance database | `postgres`              |
| Username / Password  | `picboard` / `picboard` |

Если видны «чужие» базы — клиент подключился к нативному Postgres на 5432; проверьте порт.

---

## 3. Шаг 2 — env-файлы

Каждый сервис читает env из `apps/<service>/src/env/`. Файлы делятся так:

| Файл                     | В git                    | Назначение                                                           |
| ------------------------ | ------------------------ | -------------------------------------------------------------------- |
| `.env.development`       | да                       | плейсхолдеры                                                         |
| `.env.development.local` | **нет** (`.env.*.local`) | реальные адреса для локальной разработки (Docker)                    |
| `.env.testing`           | да                       | тестовые секреты                                                     |
| `.env.testing.local`     | **нет**                  | копия `.env.testing`, но с локальной БД — перекрывает `.env.testing` |

Приоритет (`dotenv-cli`): **первый файл в цепочке `-e` выигрывает**, отсутствующий файл
молча игнорируется. Поэтому скрипты вызывают `.env.testing.local` **первым**:

```
dotenv -e …/.env.testing.local -e …/.env.testing -- <команда>
```

Ровно та же логика в рантайме Nest: `apps/<service>/src/dynamic-config.module.ts` задаёт
`envFilePath = [ENV_FILE_PATH, .env.$NODE_ENV.local, .env.$NODE_ENV, .env]`, а
`@nestjs/config` берёт значения из первого найденного файла.

### Адреса для локального Docker

```dotenv
# apps/users-microservice/src/env/.env.development.local (и .env.testing.local)
DATABASE_URL=postgresql://picboard:picboard@localhost:5433/users_db
DATABASE_DIRECT_URL=postgresql://picboard:picboard@localhost:5433/users_db
```

Для posts/files — то же с `posts_db` / `files_db`.

⚠️ Три частые ошибки:

1. **Оба URL обязательны.** `prisma/users/prisma.config.ts` читает `DATABASE_DIRECT_URL`
   (fallback — заглушка `postgresql://dummy:dummy@localhost:5432/dummy`), а код приложения —
   `DATABASE_URL`. Задали только один → получите `P1001` на localhost или `dummy`.
2. **Никаких `sslmode=…&channel_binding=…`** в локальных URL — в контейнере нет TLS.
3. **Порт 5433**, а не 5432 — иначе попадёте в нативный Postgres.

Файлы `.env.testing.local` создаются копированием `.env.testing` с заменой двух URL
(пример для PowerShell — в README, раздел «Тестовое окружение»).

---

## 4. Шаг 3 — миграции

Для разработки:

```powershell
pnpm prisma:migrate:dev:users
pnpm prisma:migrate:dev:posts
pnpm prisma:migrate:dev:files
```

Для тестовой БД (то же, но `migrate deploy` по `.env.testing.local`):

```powershell
pnpm prisma:migrate:test:users
pnpm prisma:migrate:test:posts
pnpm prisma:migrate:test:files
```

Ожидаемо для users — 10 миграций, последняя создаёт справочник и поля профиля:

```
Applying migration `20261012125021_add_country_city_and_profile_fields`
No pending migrations to apply.        # при повторном запуске
```

Что создаёт эта миграция:

- таблицы `countries` (`code` unique) и `cities` (`geonameId` unique, индексы по `countryId`, `name`, `nameRu`);
- колонки `User.firstName`, `lastName`, `dateOfBirth` (`date`), `countryId`, `cityId`;
- FK: `User → Country/City` = `ON DELETE SET NULL`, `City → Country` = `ON DELETE CASCADE`.

Всё аддитивно и nullable — существующие строки не затрагиваются.

Проверить состояние миграций:

```powershell
pnpm prisma:migration:status:users
```

---

## 5. Шаг 4 — seed справочника

### 5.1. Что в датасете

| Файл                                    | Содержимое                                                                 | Размер  |
| --------------------------------------- | -------------------------------------------------------------------------- | ------- |
| `prisma/users/seed/data/countries.json` | 250 стран: `code`, `name`, `nameRu`                                        | ~24 КБ  |
| `prisma/users/seed/data/cities.json`    | 34 160 городов: `geonameId`, `name`, `nameRu`, `countryCode`, `population` | ~4.7 МБ |

Источник — GeoNames (CC BY 4.0), подробности и текст атрибуции в
`prisma/users/seed/ATTRIBUTION.md`. Файлы уже лежат в репозитории — сеть для seed **не нужна**.

### 5.2. Запуск

```powershell
pnpm prisma:seed:users
```

Ожидаемый вывод:

```
countries upserted: 100/250
countries upserted: 200/250
countries upserted: 250/250
cities upserted: 5000/34160
…
cities upserted: 34160/34160
prune: skipped (строки вне датасета не удаляются, для чистки запусти с --prune)
DONE countries=250 cities=34160
```

Скрипт читает env из `.env.development.local` (см. `package.json` → `prisma:seed:users`).
Если нужно засеять другую базу — переопределите `DATABASE_URL`/`DATABASE_DIRECT_URL`
в этом файле или запустите скрипт напрямую:

```powershell
npx dotenv -e apps/users-microservice/src/env/.env.testing.local -- npx ts-node --transpile-only prisma/users/seed/index.ts
```

### 5.3. Как работает (важно для понимания поведения)

- **Идемпотентность.** `Country` upsert-ится по натуральному ключу `code`, `City` — по
  `geonameId`. Повторный прогон **не создаёт дублей, не меняет `id` существующих строк и
  ничего не удаляет**. Ссылки `User.countryId` / `User.cityId` остаются валидными.
- **Атомарность.** Весь прогон идёт **одной интерактивной транзакцией** (страны + города +
  prune). Обрыв на середине → БД остаётся в исходном состоянии. Таймауты подняты
  (`600 с` / `maxWait 60 с`), потому что 34k строк батчами по 5000 идут дольше дефолтных 5 с.
- **Батчи.** Страны — по 100 (через `upsert`), города — по 5000 одним `INSERT … ON CONFLICT
("geonameId") DO UPDATE`. `id` для новых городов генерится в JS (`randomUUID()`), при
  конфликте присланный id игнорируется — строка сохраняет свой.
- **Диагностика.** Если в датасете есть город с `countryCode`, которого нет в `countries.json`,
  скрипт печатает `warn: skipped N cities …` (сейчас таких нет).

### 5.4. Режим `--prune` (единственный с удалениями)

По умолчанию строки, которых нет в датасете, **не удаляются**. Чистка — только явным флагом:

```powershell
pnpm prisma:seed:users --prune
```

Вывод в этом режиме: `prune: removed cities=N countries=M`.

⚠️ Помните: FK на `User` — `ON DELETE SET NULL`, то есть у затронутых пользователей локация
обнулится. Запускать осознанно.

> Служебный `--` не нужен: `pnpm prisma:seed:users --prune` (pnpm передаёт неизвестный ему
> флаг прямо в скрипт). Форма `-- --prune` тоже работает — служебный `--` отфильтровывается
> при разборе argv.

---

## 6. Шаг 5 — проверка, что всё засеялось правильно

### 6.1. Быстрая проверка

```sql
-- в psql / pgAdmin
select count(*) from countries;              -- 250
select count(*) from cities;                 -- 34160
select count(*) from cities where population is null;   -- 0
```

### 6.2. Проверка «ничего не поехало» после повторного seed

Снять «отпечаток» таблиц до и после второго прогона — так проверяются и дубли, и
неизменность `id`:

```sql
select count(*)::int                                              as rows,
       count(distinct code)::int                                  as distinct_codes,
       count(distinct id)::int                                    as distinct_ids,
       md5(string_agg(id::text, ',' order by id))                 as ids_fingerprint
from countries;

select count(*)::int                                              as rows,
       count(distinct "geonameId")::int                           as distinct_geoname_ids,
       count(distinct id)::int                                    as distinct_ids,
       md5(string_agg(id::text, ',' order by id))                 as ids_fingerprint
from cities;
```

Ожидаемо: все значения до и после прогона **идентичны** (для нашего датасета —
`250 / 250 / 250 / ff726b31388528f8390293844e9c72a5` для стран и
`34160 / 34160 / 34160 / 6ba31f763d86906720170e56c6ee4fdd` для городов).

Если `ids_fingerprint` изменился — строки пересоздались, идемпотентность нарушена.

### 6.3. Целостность

```sql
-- города-сироты (не должно быть)
select count(*) from cities c left join countries k on k.id = c."countryId" where k.id is null;

-- дубли по натуральным ключам (не должно быть)
select "geonameId" from cities group by 1 having count(*) > 1;
select code from countries group by 1 having count(*) > 1;
```

### 6.4. Если у вас уже были пользователи с локацией

Проверка, что повторный seed их не сломал:

```sql
select count(*) filter (where "countryId" is not null) as with_country,
       count(*) filter (where "cityId"    is not null) as with_city
from "User";
```

До и после прогона числа должны совпадать. Именно это ломал старый вариант seed
(`deleteMany` + каскад обнулял локации) — теперь это невозможно.

---

## 7. GraphQL API справочника

### 7.1. Контракт

```graphql
type Country {
  id: ID!
  code: String!
  name: String!
  nameRu: String
}

type City {
  id: ID!
  name: String!
  nameRu: String
  countryId: ID!
  population: Int
}

type Query {
  countries(search: String): [Country!]! # весь список (~250), без пагинации
  cities(countryId: ID!, search: String, limit: Int = 20): [City!]! # автокомплит, кэп 50
}
```

Поведение:

- оба query **публичные** (без auth), но живут за gateway-лимитером (`/api/v1`, per-IP);
- `search` — префикс, case-insensitive, по `name` **или** `nameRu`; пустая строка/пробелы = «без поиска»;
- `limit` кэпится в `SearchCitiesQuery`: `undefined/null → 20`, `> 50 → 50`, `0`/отрицательный/`NaN → 1`;
- `countryId` валидируется как UUID (`ParseUUIDPipe`) — «мусорный» id даёт 400 сразу, а не ошибку БД;
- сортировка городов: `population DESC` (NULL в конце), затем `name ASC`.

### 7.2. Примеры запросов

```graphql
# Страны по префиксу
query {
  countries(search: "ger") {
    id
    code
    name
    nameRu
  }
}

# Автокомплит города внутри страны
query {
  cities(
    countryId: "43152b5a-5d0f-4703-8a5a-bb0a14a2d69f"
    search: "ber"
    limit: 5
  ) {
    id
    name
    nameRu
    population
  }
}
```

### 7.3. Поля у пользователя

| Поле                        | `User` (публично, `user(id)`) | `Me` (только `me`, с auth) |
| --------------------------- | ----------------------------- | -------------------------- |
| `country`, `city` (объекты) | да                            | да                         |
| `countryId`, `cityId`       | да                            | да                         |
| `email`, `isConfirmed`      | **нет**                       | да                         |
| `dateOfBirth`               | **нет**                       | пока **нет** (тикет A-5)   |

`User.country` / `Me.country` резолвятся через DataLoader: один SQL `WHERE id IN (…)` на
всех пользователей в запросе, без N+1. Кэш-ключи (`countries`, `cities`) общие, поэтому
`User` и `Me` не создают двух загрузчиков. Общий код — `graphql/resolvers/user-location.fields.ts`.

Пример:

```graphql
query {
  me {
    id
    username
    email
    countryId
    cityId
    country {
      id
      name
      nameRu
    }
    city {
      id
      name
      nameRu
    }
  }
}
```

---

## 8. Тесты

| Команда                          | Что проверяет                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                      | unit: 13 suites / 69 тестов (включая кэп лимита, trim поиска, батчинг DataLoader, `null` при отсутствии id)    |
| `pnpm prisma:migrate:test:users` | схема в тестовой БД (идемпотентно)                                                                             |
| `pnpm test:users:e2e`            | 16 тестов: auth-flow, refresh-rotation, OAuth, чистка после прогона, `me` с auth и без, приватность `user(id)` |
| `pnpm test:posts:e2e`            | 12 тестов: feed, create/edit/delete, видимость удалённого                                                      |

Что важно про e2e users:

- он создаёт пользователей `e2e-<ts>-<rand>@example.com` и `oauth-test@example.com`;
- в `afterAll` они **удаляются** (`deleteMany` по этим шаблонам), каскадом уходят
  `RefreshToken` / `UserConsent` / `OAuthAccount` / `OAuthExchangeCode`;
- тесты чистят за собой в `afterAll`; если прогон упадёт **до** него — пользователи
  останутся в базе, поэтому для чистых прогонов лучше держать отдельную тестовую БД
  (например `users_e2e`) и указывать её в `.env.testing.local`.

---

## 9. Перегенерация датасета (если нужно обновить GeoNames)

Требуется интернет; скачивается ~180+ МБ в `prisma/users/seed/.cache` (в git не попадает):

```powershell
npx ts-node --transpile-only prisma/users/seed/fetch-data.ts
```

Скрипт:

1. тянет `countryInfo.txt` и `cities15000.zip`, фильтрует устаревшие ISO-коды через `world-countries`;
2. собирает русские названия из `alternateNamesV2.zip` (`isolanguage = 'ru'`), иначе — эвристика по кириллице из `alternatenames`;
3. пишет `data/countries.json` и `data/cities.json`.

После обновления датасета: обновите `ATTRIBUTION.md` (дата/состав), прогоните seed и
проверьте отпечатки (§6.2) — `cities.json` в git меняется, значит `id` всё равно не должны
меняться (они привязаны к `geonameId`).

Зависимости для скрипта (`adm-zip`, `unzipper`, `world-countries`) стоят в `devDependencies`.

---

## 10. Полный сброс окружения

```powershell
# удалить контейнер и данные → init-скрипт выполнится заново
docker compose -f docker-compose.db.yml down -v
docker compose -f docker-compose.db.yml up -d

# схема
pnpm prisma:migrate:dev:users
pnpm prisma:migrate:dev:posts
pnpm prisma:migrate:dev:files

# справочник
pnpm prisma:seed:users
```

---

## 11. Troubleshooting

| Симптом                                                                 | Причина / решение                                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `P1001: Can't reach database server at …:5432`                          | в URL остался порт 5432 (нативный Postgres) или `DATABASE_DIRECT_URL` не переопределён               |
| В ошибке фигурирует `dummy:dummy@localhost`                             | не задан `DATABASE_DIRECT_URL` — `prisma/users/prisma.config.ts` подставил заглушку                  |
| `server does not support SSL` / `channel binding … not supported`       | в URL остались `sslmode=…&channel_binding=…`                                                         |
| `port is already allocated`                                             | 5433 тоже занят → поменяйте маппинг в `docker-compose.db.yml` на `"5434:5432"` и порт в env-файлах   |
| `database "posts_db" does not exist`                                    | init-скрипт выполняется только при создании тома → `down -v` + `up -d`                               |
| `relation "cities" does not exist`                                      | не накатаны миграции (`pnpm prisma:migrate:dev:users`)                                               |
| `there is no unique or exclusion constraint matching the ON CONFLICT …` | в БД нет unique-индекса `cities_geonameId_key` — миграция не применилась                             |
| `column "population" of relation "cities" does not exist`               | схема БД не совпадает с кодом (таблицу правили руками / миграция не та)                              |
| `prisma migrate status` ругается на `some-url`                          | скрипты `migration:status:*` читают `.env.development.local`; там должны быть реальные локальные URL |
| seed идёт долго                                                         | 34k строк батчами; на медленном томе уменьшите `CITY_BATCH` в `prisma/users/seed/index.ts`           |
| e2e падает на отсутствии таблиц                                         | тестовая БД без миграций → `pnpm prisma:migrate:test:users`                                          |
| `pnpm test:files:e2e` → «No tests found»                                | спеков нет, это не поломка                                                                           |

---

## 12. Известные ограничения / что дальше

- **A-5 не закрыт**: в схеме пока нет `firstName`, `lastName`, `dateOfBirth`, `aboutMe`,
  вычисляемого `displayName`; план — `agent/profile-dev-a-jira-tasks.md`, раздел A-5.
- **`dateOfBirth` только для `Me`** — публично не отдаётся by design.
- **Поиск — префиксный**, `pg_trgm`/GIN не подключён (тикет TD-2): на текущем размере хватает
  b-tree по `countryId`, но подстрочный поиск индекса не получит.
- **Экранирование `%`/`_` в `search`** не проверено на текущей версии Prisma — если клиент
  пришлёт `%`, поведение зависит от того, эскейпит ли движок wildcards.
- **44 % городов без `nameRu`** (15 099 из 34 160) — известное ограничение источника.
- **Датасет 4.7 МБ в git** — осознанный компромисс (воспроизводимость офлайн) против размера репозитория.

---

## 13. Шпаргалка

```powershell
# поднять/остановить БД
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.db.yml down          # без -v: данные сохранятся
docker compose -f docker-compose.db.yml logs -f

# схема
pnpm prisma:migrate:dev:users
pnpm prisma:migrate:test:users
pnpm prisma:migration:status:users

# справочник
pnpm prisma:seed:users                 # идемпотентно, без удалений
pnpm prisma:seed:users --prune         # + чистка строк вне датасета (осознанно!)

# тесты
pnpm test
pnpm test:users:e2e
pnpm test:posts:e2e

# посмотреть данные
docker exec -it picboard-pg psql -U picboard -d users_db -c "select count(*) from cities;"
```
