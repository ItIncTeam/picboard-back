# Почему пришлось переписать `createGraphqlFormatError`

Разбор бага: все ошибки от сервисов приходили клиенту как HTTP 500.

Затронутые файлы:

- `libs/common/src/graphql/create-graphql-format-error.ts`
- `libs/common/src/graphql/types/graphql-api-error.type.ts`
- `apps/posts-microservice/test/app.e2e-spec.ts:166`

---

## Симптом

Запрос без токена авторизации возвращал **HTTP 500** вместо ожидаемого 401.
То же самое происходило с любой другой ошибкой: ошибки валидации, «не найдено»,
«нет доступа» — все приходили клиенту как 500.

---

## Где терялся правильный статус

Важно понять: **правильный статус вычислялся корректно**. Его уничтожал
следующий этап обработки.

Цепочка при запросе без токена:

1. **Gateway** (`picboard-data-source.ts:55`) — заголовка `Authorization` нет,
   поэтому JWT не проверяется и заголовок `x-user-id` не проставляется.
   Запрос уходит в subgraph как анонимный. Так и задумано: gateway проверяет
   токен только если он реально передан.
2. **Middleware subgraph** пропускает запрос — секрет роутера валиден,
   анонимен только пользователь.
3. **`normalizeContext`** → `auth.userId` = `undefined`.
4. **`@CurrentUserId()`** бросает `UnauthorizedException`. **Всё правильно.**
5. **`formatError` в subgraph** определяет статус 401 и возвращает
   `{ message, code: 'UNAUTHENTICATED', statusCode: 401, errors: null }`.
   **Тоже правильно.**
6. **Gateway прогоняет эту ошибку через тот же самый `formatError`.**
   Вот здесь всё и ломалось.

---

## Корень проблемы

По спецификации GraphQL объект ошибки (`GraphQLFormattedError`) может содержать
только четыре поля:

```
message, locations, path, extensions
```

А старый код возвращал:

```ts
{ message, code, statusCode, errors }
```

`code` и `statusCode` лежали **на верхнем уровне** — то есть в полях, которых
спецификация не знает. При сериализации ответа они просто отбрасывались,
а `extensions` оставался пустым.

Дальше gateway применял ту же функцию к уже обработанной ошибке,
и ни одна проверка не срабатывала:

| Проверка в коде | Значение на втором проходе |
|---|---|
| `formattedError.extensions?.code` | `undefined` — код положили на верхний уровень |
| `unwrapResolverError(error)` | это не ошибка резолвера, а `GraphQLError` от subgraph |
| `resolverError?.statusCode` | `undefined` |
| `resolverResponse?.statusCode` (`.response`) | `undefined` — у `GraphQLError` нет `.response` |
| `extensions?.originalError?.statusCode` | `undefined` |

Все `if` промахивались, выполнение доходило до последнего `return` — и ошибка
становилась `INTERNAL_SERVER_ERROR` / 500.

---

## Одним предложением

> **Функция не была идемпотентной.** Она принимала стандартную форму ошибки,
> а возвращала нестандартную. Поэтому второй вызов (в gateway) не мог прочитать
> то, что записал первый (в subgraph), и терял весь результат его работы.

Сама по себе функция была написана правильно. Ломалось именно то, что
в федерации она вызывается **дважды**.

---

## Что изменили

### 1. `code` / `statusCode` / `errors` переехали в `extensions`

Единственное место, которое переживает сериализацию. Это и есть исправление.

**Было:**

```ts
return {
  message: message || 'Unauthorized',
  code: 'UNAUTHENTICATED',
  statusCode: 401,
  errors: null,
};
```

**Стало:**

```ts
return {
  message: message || 'Unauthorized',
  locations: formattedError.locations,
  path: formattedError.path,
  extensions: {
    code: 'UNAUTHENTICATED',
    statusCode: 401,
    errors: null,
  },
};
```

### 2. Второй проход теперь читает то, что записал первый

```ts
const getStatus = (expected: number) =>
  resolverError?.statusCode === expected ||
  resolverResponse?.statusCode === expected ||
  originalError?.statusCode === expected ||
  // второй проход: статус, записанный subgraph'ом в extensions
  formattedError.extensions?.statusCode === expected;
```

Аналогично для `errors` — добавлен фолбэк на `formattedError.extensions?.errors`.
Без него на втором проходе терялись ошибки валидации по полям:
`resolverError` и `resolverResponse` там оба `undefined`.

### 3. `locations` и `path` теперь передаются дальше

Раньше они молча терялись, из-за чего у ошибок не было информации о том,
в каком месте запроса они возникли.

---

## Почему две ветки оставлены развёрнутыми

Ветки `GRAPHQL_VALIDATION_FAILED` и финальная `INTERNAL_SERVER_ERROR`
намеренно не используют хелпер `build()`.

`build()` отдаёт приоритет сообщению из резолвера:

```ts
message: message || fallbackMessage
```

Для ветки 500 это критично. Там текст выбирается специально:

```ts
message: isProduction ? 'Internal server error' : defaultMessage
```

Если бы эта ветка использовала `build()`, в продакшене клиенту ушло бы
внутреннее сообщение об ошибке — ровно то, что эта ветка должна скрывать
(имена бакетов, ARN, внутренние адреса).

---

## Что меняется для клиентов

Ломающее изменение в форме ответа:

```js
errors[0].code        →  errors[0].extensions.code
errors[0].statusCode  →  errors[0].extensions.statusCode
errors[0].errors      →  errors[0].extensions.errors
```

`errors[0].message` остаётся на месте.

Новая форма — **стандартная для GraphQL**, её ожидают все клиентские библиотеки
(Apollo Client, urql и прочие) из коробки. Раньше фронтенд был вынужден читать
поля, которых в спецификации нет.

В тестах поправлена одна проверка: `apps/posts-microservice/test/app.e2e-spec.ts:166`.

---

## Побочный эффект

После этого исправления заработала и серверная валидация входных данных:
её ошибки теперь доходят до клиента как 400 с полем `extensions.errors`,
а не как безликий 500.

До исправления включать валидацию было почти бессмысленно — клиент всё равно
не смог бы отличить ошибку в своих данных от падения сервера.
