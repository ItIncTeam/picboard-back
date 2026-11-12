# Attribution — справочник стран и городов

Данные в `prisma/users/seed/data/` являются производными от открытых датасетов
и **не являются** собственностью проекта.

## GeoNames

- Источник: [GeoNames](https://www.geonames.org/) — [экспорт дампов](https://download.geonames.org/export/dump/)
- Использованные файлы дампа:
  - `cities15000.zip` → `cities15000.txt` — города с населением ≥ 15 000
  - `countryInfo.txt` — коды и названия стран (ISO 3166-1 alpha-2)
  - `alternateNamesV2.zip` → `alternateNamesV2.txt` — русские названия (`isolanguage = 'ru'`)
- Лицензия: **Creative Commons Attribution 4.0 International (CC BY 4.0)** —
  https://creativecommons.org/licenses/by/4.0/

Обязательный текст атрибуции:

> Contains information from GeoNames (https://www.geonames.org/), which is
> made available under the Creative Commons Attribution 4.0 License
> (CC BY 4.0).

## world-countries

- Пакет: [`world-countries`](https://www.npmjs.com/package/world-countries)
- Используется только в `fetch-data.ts` — для русских названий стран
  (`translations.rus.common`) и фильтрации устаревших ISO-кодов.
- Лицензия: **Open Database License (ODbL)** — https://opendatacommons.org/licenses/odbl/1-0/

## Что именно лежит в репозитории

`countries.json` и `cities.json` — **нормализованные производные** (не сырые дампы):
из GeoNames выбраны только нужные поля и только актуальные ISO-коды стран.

| Файл             | Содержимое                                              | Объём                              |
| ---------------- | ------------------------------------------------------- | ---------------------------------- |
| `countries.json` | `code, name (en), nameRu`                               | 250 стран                          |
| `cities.json`    | `geonameId, name (en), nameRu, countryCode, population` | 34 160 городов, ~44 % без `nameRu` |

Дата формирования датасета — коммит, которым добавлены `data/*.json`.
Скрипт перегенерации: `prisma/users/seed/fetch-data.ts` (см. README, раздел
«Справочник стран/городов (users)»).

## Требования при распространении

При публикации или передаче данных третьим лицам атрибуция выше должна
сохраняться. При обновлении датасета — обновите этот файл (источник, состав,
дата).
