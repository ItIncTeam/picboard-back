# Обработка ошибок в PICboard — полный разбор

> Документ описывает, как в проекте устроена обработка исключений: от теории NestJS
> до сквозных сценариев и правил проектирования границ. Все примеры — из реального
> кода репозитория `ItIncTeam/picboard-back` (ветка `rpcExceptionsHandling`).
>
> Ссылки вида `файл.ts` указывают на место в коде.
>
> Документ обновлён после применения правок **P1–P3** (RPC-фильтр, статусы в маппере,
> классификация ретраев) и выноса общего контракта в `@app/contracts` — см. Приложение A.
> Разделы 3.5, 6.3, 6.5, 6.7, 6.8 отражают новое состояние.

---

# Часть 1. Теория: как вообще ловятся ошибки в NestJS

## 1.1. Исключение — это просто `throw`

Любое `throw new SomethingError()` внутри обработчика не «падает» само по себе: Nest
перехватывает его и превращает в ответ. Ключевой вопрос всегда один — **кто именно
поймает** это исключение и в какую форму сериализует.

## 1.2. Конвейер обработки запроса

Каждый запрос проходит звенья в строгом порядке. Ошибку можно бросить на любом — и её
поймает фильтр:

```
middleware → guards → interceptors → pipes → handler → (ответ)
                ↓         ↓           ↓        ↓
           ───────────── exception filter ─────────────
```

- **Middleware** — самое раннее; его ошибки Nest-фильтры не ловят (обрабатывает Express).
- **Guard** — гейткипер доступа (аутентификация/авторизация). Бросает, если доступа нет.
- **Pipe** — валидация/трансформация входа. Бросает, если вход невалиден.
- **Handler** — ваш метод (`resolver` / `controller` / `@MessagePattern`).

## 1.3. Exception filter — что это

Фильтр — класс с декоратором `@Catch(...)`, который перехватывает исключения и решает,
что вернуть. Три уровня «прицела»:

| Scope | Как задаётся | Что ловит |
| --- | --- | --- |
| Global | `{ provide: APP_FILTER, useClass: X }` или `app.useGlobalFilters()` | всё в приложении |
| Controller | `@UseFilters(X)` | всё в этом контроллере |
| Method | `@UseFilters(X)` на методе | только этот хендлер |

Когда бросается исключение, Nest идёт **снизу вверх** (метод → контроллер → глобальные) и
берёт **первый** фильтр, чей `@Catch` совпал. Если ни один не совпал — работает
**дефолтный** фильтр, и вот он-то и различается по «мирам».

## 1.4. Главная идея: поведение по умолчанию зависит от «мира»

Nest мультитранспортный. Один и тот же `throw` обрабатывается по-разному в зависимости
от `host.getType()`:

| `host.getType()` | Транспорт в PICboard | Дефолтный фильтр | Как сериализует |
| --- | --- | --- | --- |
| `'http'` | Express (gateway, OAuth-контроллеры) | `BaseExceptionFilter` | `HttpException` → свой статус+тело; прочее → 500 |
| `'graphql'` | Apollo (субграфы) | error уходит в Apollo + `formatError` | через `formatError` |
| `'rpc'` | TCP (posts→files) | `BaseRpcExceptionFilter` | **только `RpcException` пробрасывается как есть** |

## 1.5. Дефолтный обработчик RPC — самый «коварный»

Читаем реальный код из `node_modules/@nestjs/microservices/exceptions/base-rpc-exception-filter.js`:

```js
catch(exception, host) {
    const status = 'error';
    if (!(exception instanceof RpcException)) {
        return this.handleUnknownError(exception, status);   // ← любой HttpException сюда!
    }
    const res = exception.getError();                        // RpcException → payload как есть
    const message = isObject(res) ? res : { status, message: res };
    return throwError(() => message);
}
```

А `handleUnknownError` возвращает `{ status: 'error', message: 'Internal server error' }`.

**Вывод, который надо запомнить:** через RPC(TCP) можно передать смысл ошибки **только**
с помощью `RpcException`. Любой другой класс (`BadRequestException`,
`GatewayTimeoutException`, `Error`…) будет «сплющен» до
`{ status: 'error', message: 'Internal server error' }` — статус и сообщение теряются.

---

# Часть 2. Как устроен PICboard (кто кого зовёт)

```
Клиент
  │  HTTP (Authorization: Bearer, cookies)
  ▼
Gateway  ── Apollo Federation, /api/v1 ── HTTP ──▶ субграфы users / posts / files
  │                                                (у каждого свой GraphQL)
  │
  └─ внутри posts: FilesServiceClient ── TCP (MessagePattern) ──▶ files
```

- **Gateway** `apps/gateway` — единая точка входа, Apollo Federation
  (`apps/gateway/src/app.module.ts`).
- **Субграфы** `users/posts/files` — обычные HTTP-сервисы с GraphQL.
- **Единственный RPC-путь** — posts → files по TCP
  (`apps/posts-microservice/src/infrastructure/client/files-service.client.ts`).
- **users → RMQ** — целиком закомментирован (мёртвый код)
  (`apps/users-microservice/src/infrastructure/messaging/users-events.publisher.ts`).

То есть в проекте живут три «мира» одновременно — это и есть причина, почему обработка
ошибок выглядит разнородно.

---

# Часть 3. Источники ошибок в проекте — по слоям

## 3.1. Валидация входа (pipes)

Самый «ожидаемый» класс ошибок. В проекте **два** разных пайпа — под HTTP/GraphQL и под RPC.

**HTTP/GraphQL** — `createValidationPipe()` (глобально во всех сервисах:
`apps/users-microservice/src/main.ts`, `apps/posts-microservice/src/main.ts`,
`apps/files-microservice/src/main.ts`):

```ts
// libs/common/src/validation/create-validation-pipe.ts
exceptionFactory: (errors) => {
  const formatted = formatValidationErrors(errors);
  const firstMessage = formatted[0]?.message ?? 'Validation failed';
  return new BadRequestException({ message: firstMessage, errors: formatted });
},
```

Результат — обычный `BadRequestException` (HTTP-мир, статус 400, с полем `errors`).

**RPC** — `createRpcValidationPipe()` только на TCP-хендлерах
(`apps/files-microservice/src/files/tcp/files-tcp.controller.ts`):

```ts
// libs/common/src/validation/create-rpc-validation-pipe.ts
return new RpcException({
  statusCode: 400,           // ← добавление PR #26
  message: firstMessage,
  errors: formatted,
});
```

Здесь важен `statusCode`: без него в RPC-мире полезная нагрузка не выживет (см. 1.5).

Оба используют общий `formatValidationErrors()`
(`libs/common/src/validation/format-validation-errors.ts`), который разворачивает вложенные
`ValidationError` в плоский список `{ field, message }`.

## 3.2. Аутентификация / авторизация (guards + gateway)

Тут три разных механизма, их не нужно путать.

**(а) Gateway проверяет пользовательский JWT** — `PicboardDataSource.willSendRequest`
(`apps/gateway/src/auth/picboard-data-source.ts`):

```ts
try {
  payload = this.jwtService.verify(token, { secret: this.appConfig.jwtAccessSecret });
} catch {
  throw new UnauthorizedException('Invalid or expired token');
}
...
request.http?.headers.set('x-user-id', String(userId));
```

Плохой токен → `UnauthorizedException`. Хороший токен разворачивается в заголовки
`x-user-id` / `x-user-role` / `x-session-id`.

**(б) Субграф защищён от прямых запросов** — `SubgraphGatewayAuthMiddleware`
(`libs/common/src/subgraph-auth/subgraph-gateway-auth.middleware.ts`):

```ts
if (routerAuthorization !== expectedSecret) {
  throw new UnauthorizedException('Invalid gateway authorization');
}
```

Это middleware: любой, кто стучится в субграф мимо гейтвея, получает 401.

**(в) Контекст и декоратор** — `normalizeContext` раскладывает заголовки в `context.auth`
(`libs/common/src/graphql/normalize-context.ts`), а `@CurrentUserId()` бросает, если
пользователя нет (`libs/common/src/decorators/auth/current-userId.ts`):

```ts
if (!userId) throw new UnauthorizedException('User not authenticated');
```

Плюс есть `RecaptchaGuard` (навешан на `AuthResolver`
`apps/users-microservice/src/graphql/resolvers/auth.resolver.ts`) — пример **guard’а,
который бросает `BadRequestException('Captcha token is missing')`**
(`libs/common/src/guards/recaptcha.guard.ts`).

## 3.3. Доменные ошибки (use cases / resolvers)

Бизнес-правила бросают семантические HTTP-исключения прямо в домене:

- `SignInUserUseCase` → `UnauthorizedException('Invalid credentials')`,
  `('Email is not confirmed')`, `('Account uses OAuth...')`
  (`apps/users-microservice/src/application/use-cases/sign-in-user/sign-in-user.use.case.ts`).
- `DeletePostUseCase` → `NotFoundException('Post not found')`,
  `ForbiddenException('Access denied')`
  (`apps/posts-microservice/src/application/use-cases/delete-post/delete-post.use.case.ts`).
- `FilesResolver.resolveFile` → `NotFoundException('File ID was not provided')`
  (`apps/files-microservice/src/graphql/resolvers/files.resolver.ts`).
- `AuthResolver.refreshToken` → `UnauthorizedException('No refresh token provided')`
  (`apps/users-microservice/src/graphql/resolvers/auth.resolver.ts`).

Идея: домен не знает про транспорт, он бросает типизированные исключения, а транспорт
(мир) их сериализует.

## 3.4. Инфраструктура / БД (Prisma)

Здесь — единственный **глобальный контекст-зависимый** фильтр. `PrismaExceptionFilter`
(`libs/common/src/prisma/prisma-exception.filter.ts`), зарегистрирован как `APP_FILTER`
через `PrismaExceptionModule` (`libs/common/src/prisma/prisma-exception.module.ts`).

Он ловит `PrismaClientKnownRequestError`, превращает код в HTTP-исключение через
`mapPrismaErrorCode()` (P2002→409, P2025→404, P2024→504 и т.д.
`libs/common/src/filters/map-prisma-error-code.ts`), а затем **ветвится по миру**:

```ts
switch (host.getType<GqlContextType>()) {
  case 'graphql':
    throw error;                                     // отдать Apollo/formatError
  case 'rpc':
    return throwError(() => new RpcException({       // ← правильная форма для RPC
      statusCode: error.getStatus(),
      message: error.message,
    }));
  default:                                            // http
    response.status(error.getStatus()).json(error.getResponse());
}
```

Обратите внимание: **это и есть образец**, которому в части RPC не следует
`create-rpc-validation-pipe` до правки PR #26 — фильтр честно заворачивает статус в
`RpcException`.

## 3.5. Межсервисные ошибки (RPC posts→files)

Клиент ловит ошибку от TCP и переводит её в HTTP-исключение
(`apps/posts-microservice/src/infrastructure/client/files-service.client.ts`):

```ts
} catch (error) {
  throw mapRpcErrorToHttpException(error, { serviceLabel: 'Files service' });
}
```

`mapRpcErrorToHttpException` (`libs/common/src/rpc/map-rpc-error-to-http.ts`) — читает
`statusCode` из «полезной нагрузки»:

```
TimeoutError      → 504 GatewayTimeout
statusCode: 400   → BadRequest (сохраняет errors)
401/403/404/409   → соответствующие
500 / 504         → InternalServerError / GatewayTimeout   ← добавлено правкой P2
default (нет кода)→ 503 ServiceUnavailable
```

Канонический тип payload — `RpcErrorPayload` — вынесен в `@app/contracts`
(`libs/contracts/src/rpc/rpc-error-payload.ts`) и используется с обеих сторон:
`createRpcValidationPipe` / `HttpToRpcExceptionFilter` его формируют, а
`mapRpcErrorToHttpException` читает.

**Тонкость (историческая, закрыта правкой P1):** маппер бесполезен, если сервер присылает
не `RpcException`, а обычный `HttpException` — Nest «сплющит» его в
`{ status:'error', message:'Internal server error' }` без `statusCode`, и всё уедет в
`default → 503`. Раньше так и было у `CheckOwnedReadyFilesHandler`; теперь это
перехватывает `HttpToRpcExceptionFilter` (см. Приложение A).

## 3.6. Форматирование на гейтвее (formatError)

Финальный слой — `createGraphqlFormatError()`
(`libs/common/src/graphql/create-graphql-format-error.ts`), настроен и на субграфах, и на
гейтвее. Он приводит любую ошибку к публичной форме
`{ message, extensions: { code, statusCode, errors } }` (см. тип кодов
`libs/common/src/graphql/types/graphql-api-error.type.ts`).

Ключевой момент, заложенный авторами: **он выполняется дважды** — сначала в субграфе,
потом в гейтвее над уже отформатированной ошибкой, поэтому обязан быть идемпотентным
(читает `statusCode` из `resolverError` / `resolverResponse` / `originalError` /
`extensions` — и пишет обратно в `extensions`).

---

# Часть 4. Сквозные примеры (от `throw` до ответа клиенту)

## Пример A. Создание поста с чужим файлом (валидация на TCP + маппинг)

```
1. Клиент: mutation createPost(fileIds)
2. Gateway: проверяет JWT → ставит x-user-id
3. posts resolver → CreatePostUseCase.execute()
4. posts: filesClient.assertAllOwnedReadyOrException()
      └─ TCP send CHECK_OWNED_READY ─▶ files
5. files: FilesTcpController.checkOwnedReady
      └─ @UsePipes(createRpcValidationPipe()) → payload невалиден
         throw RpcException({ statusCode:400, message, errors })
6. files: дефолтный RPC-фильтр: RpcException → пробрасывает payload как есть
7. posts: catch → mapRpcErrorToHttpException → BadRequestException({ message, errors })
8. posts: GraphQL formatError → { extensions: { code:'BAD_USER_INPUT', statusCode:400, errors } }
9. Gateway: свой formatError (идемпотентно) → тот же результат
10. Клиент: 400 BAD_USER_INPUT + список полей
```

Это **работающий** путь PR #26: `statusCode:400` доводит смысл через все границы.

## Пример B. Таймаут БД внутри files (сейчас теряет статус)

```
5'. files: CheckOwnedReadyFilesHandler — таймаут срабатывает
        withTimeout → throw GatewayTimeoutException (504)
6'. files: дефолтный RPC-фильтр: это НЕ RpcException →
        { status:'error', message:'Internal server error' }   ← 504 и текст потеряны
7'. posts: mapRpcErrorToHttpException: нет statusCode → default → 503
```

Итог: задуманный `504 GATEWAY_TIMEOUT` деградирует до `503`, а причина
(«Files repository request timed out») не доезжает.

## Пример C. Регистрация с занятым email (Prisma)

```
3. users: SignUpUserUseCase → prisma.user.create() → PrismaClientKnownRequestError P2002
4. PrismaExceptionFilter (@Catch(PrismaClientKnownRequestError)):
      mapPrismaErrorCode('P2002') → ConflictException('Resource already exists')
      host.getType()==='graphql' → throw error
5. formatError → { extensions: { code:'CONFLICT', statusCode:409 } }
```

Здесь всё чисто — единственный класс ошибок, где статус гарантированно доезжает у всех миров.

## Пример D. Невалидный вход GraphQL (validation pipe)

```
3. users: signIn(input) → глобальный createValidationPipe()
      input не прошёл class-validator → BadRequestException({ message, errors })
4. formatError → 400 BAD_USER_INPUT
```

## Пример E. Неавторизованный запрос

```
2'. Gateway: JWT невалиден → UnauthorizedException('Invalid or expired token')
       (либо субграф: SubgraphGatewayAuthMiddleware → 401)
3'. formatError → 401 UNAUTHENTICATED
```

Либо, если вызов минул гейтвей, `@CurrentUserId()` даст
`UnauthorizedException('User not authenticated')`.

---

# Часть 5. Итоговая карта

## «Кто бросает → кто ловит → что на выходе»

| Источник | Пример в коде | Класс ошибки | Ловит | Финал |
| --- | --- | --- | --- | --- |
| Валидация HTTP/GQL | `create-validation-pipe.ts` | `BadRequestException` | дефолт (http/gql) | 400 |
| Валидация RPC | `create-rpc-validation-pipe.ts` | `RpcException`+400 | RPC-дефолт пропускает | доходит до маппера |
| Guard (recaptcha) | `recaptcha.guard.ts` | `BadRequestException` | дефолт | 400 |
| Аутентификация | `picboard-data-source.ts` | `UnauthorizedException` | дефолт | 401 |
| Домен | `sign-in-user.use.case.ts` | `UnauthorizedException` | дефолт | 401 |
| Домен | `delete-post.use.case.ts` | `NotFound/Forbidden` | дефолт | 404/403 |
| БД | `prisma-exception.filter.ts` | `PrismaClientKnownRequestError` | `PrismaExceptionFilter` | 409/404/400/504 |
| RPC клиент | `files-service.client.ts` | payload от TCP | `catch` + mapper | 400/503/… |
| Формат | `create-graphql-format-error.ts` | любой | GraphQL-хук | `{code,statusCode,errors}` |

## Четыре правила

1. **Мир решает форму.** Один `throw` даст 400 в HTTP, GraphQL-ошибку в GraphQL и
   `{status:'error'}` в RPC. Нельзя писать фильтр «в общем виде», не глядя на `host.getType()`.
2. **Через RPC проходит только `RpcException`.** Хотите протащить статус/детали —
   конвертируйте в `RpcException` (как делает `PrismaExceptionFilter`).
3. **`formatError` идемпотентен по необходимости.** Он гоняется дважды (субграф → гейтвей)
   и общается через `extensions`.
4. **Граница — самое хрупкое место.** Ошибки нужно «переводить» на каждой границе: pipes
   (вход), RPC (между сервисами), gateway (наружу). Провал на любой из них = потеря смысла.

---

# Часть 6. Правило 4 подробно: граница — самое хрупкое место

## 6.1. Что такое «граница»

**Граница** — это точка, где данные или управление переходят из одного контекста в другой,
и где **меняется контракт ошибки**. За границей действует другой «мир» (`host.getType()`),
другой сериализатор, другой дефолтный фильтр.

В PICboard границы трёх видов:

**По транспорту (между процессами):**
```
клиент ── HTTP ──▶ gateway ── GraphQL(HTTP) ──▶ субграфы
                                     └─ TCP ──▶ files
```

**По слоям (внутри процесса):**
```
guard → pipe → handler → use case (домен) → репозиторий (Prisma) → транспорт наружу
```

**По сериализации (сетевой провод):** через TCP/HTTP передаются только **простые данные**
(JSON). `instanceof`, прототипы, геттеры — всё это умирает.

Границей является **каждая стрелка** на этих схемах. И на каждой стрелке ошибку надо
«перевести».

## 6.2. Почему границы ломаются — четыре причины

**Причина 1. У каждой стороны свой контракт ошибки.**
В домене вы бросаете `NotFoundException`, а на другом конце провода ждут
`{ statusCode, message }`. Никто не обязан понимать вашу форму.

**Причина 2. Сериализация убивает типы.**
Когда `RpcException` летит через TCP, класс уже не тот — прилетает **plain-объект**.
Проверка `error instanceof BadRequestException` на клиенте **всегда `false`**. Поэтому
клиентский маппер и смотрит на `rpc.statusCode`, а не на класс.

**Причина 3. Дефолтные фильтры у миров разные.**
Один и тот же `throw` даёт 400 в HTTP, GraphQL-ошибку в GraphQL и
`{ status:'error', message:'Internal server error' }` в RPC.

**Причина 4. Каждое пересечение — потенциальная утечка информации.**
Живой пример из кода. `CheckOwnedReadyFilesHandler` бросает `GatewayTimeoutException` (504):

```
files:  throw GatewayTimeoutException (504)
        ↓  граница RPC: HttpException ≠ RpcException
провод: { status:'error', message:'Internal server error' }   ← 504 и текст ПОТЕРЯНЫ
        ↓  граница RPC-клиента: нет statusCode
posts:  default → ServiceUnavailableException (503)            ← 504 стал 503
```

Три границы — и на одной из них смысл развалился. Это и есть «хрупкость».

## 6.3. Все границы PICboard

| # | Граница | Что пересекает | Форма до | Форма после | Кто переводит |
| --- | --- | --- | --- | --- | --- |
| A | Prisma → приложение | бизнес-запрос ↔ SQL | `PrismaClientKnownRequestError` (код Pxxxx) | `HttpException` | `PrismaExceptionFilter` + `mapPrismaErrorCode` |
| B | домен → транспорт | use case ↔ резолвер | `HttpException` | — | пока никто (домен сам бросает HTTP) |
| C | сервер сервиса → клиент (RPC) | files ↔ posts | `HttpException` | plain `{statusCode,message}` | `HttpToRpcExceptionFilter` (P1) |
| D | RPC-клиент → локальный мир | posts TCP catch | plain `{statusCode,message}` | `HttpException` | `mapRpcErrorToHttpException` (P2) |
| E | субграф → gateway | GraphQL | `GraphQLError` | GraphQL-ответ | `formatError` (субграф) |
| F | gateway → клиент | GraphQL | GraphQL-ответ | финальный ответ | `formatError` (гейтвей) |
| G | gateway → субграф (вход) | HTTP | JWT | заголовки `x-user-id` | `PicboardDataSource` |
| H | клиент → субграф (защита) | HTTP | — | 401 | `SubgraphGatewayAuthMiddleware` |

Восемь мест, где ошибка меняет форму. Каждое — точка риска.

## 6.4. Что значит «сделать правильно» — шесть принципов

### Принцип 1. Один канонический формат ошибки на проводе
Зафиксируйте единый контракт, который ходит через все границы. Для RPC он по факту такой:

```ts
{ statusCode: number, message: string, errors?: { field, message }[] }
```

**Сделано:** тип вынесен в `@app/contracts`
(`libs/contracts/src/rpc/rpc-error-payload.ts`) и импортируется с обеих сторон —
`createRpcValidationPipe` / `HttpToRpcExceptionFilter` формируют его, а
`mapRpcErrorToHttpException` читает. Раньше тип был объявлен локально на клиентской
стороне, из-за чего формат мог разъехаться.

### Принцип 2. Переводить НА границе, одной ответственностью
На каждой границе — **ровно один** адаптер, отвечающий за перевод:

| Граница | Адаптер | Чем занят |
| --- | --- | --- |
| A | `mapPrismaErrorCode` | код БД → HTTP-семантика |
| C | RPC-фильтр | `HttpException` → `RpcException` с payload |
| D | `mapRpcErrorToHttpException` | payload → `HttpException` |
| E/F | `formatError` | `HttpException` → публичная форма |

Никакой доменный код не должен вручную собирать `RpcException` или GraphQL-ошибки.

### Принцип 3. Наружу не выходит «сырое» исключение
Инвариант: в момент пересечения границы ошибка **уже** приведена к канонической форме.
Если на клиент летит `Error` или `{status:'error',...}` — граница сломана. Показательный
анти-паттерн — как раз `handleUnknownError` из Nest.

### Принцип 4. Сохранять машинно-читаемый статус, а не только текст
Текст нужен человеку, **код нужен следующей границе**. Именно поэтому
`createRpcValidationPipe` добавляет `statusCode: 400`, а не только `message`. Без кода
следующий маппер «слепнет» и уводит всё в default.

### Принцип 5. Идемпотентность повторного прохода
`formatError` вызывается дважды (субграф → гейтвей). Поэтому он хранит
`statusCode`/`code` в `extensions` и читает оттуда
(`libs/common/src/graphql/create-graphql-format-error.ts`). Если сделать неидемпотентно —
второй проход обнулит ошибку до 500.

### Принцип 6. Классификация «повторять / не повторять»
Граница обязана сохранять признак **клиентская ошибка (4xx) vs серверная/транспортная
(5xx)**. **Сделано (P3):** воркер `file-deletion-outbox.worker`
(`apps/posts-microservice/src/infrastructure/worker/file-deletion-outbox.worker.ts`)
теперь читает `statusCode` из payload и сразу помечает 4xx-задачу `FAILED`, не тратя
попытки; 5xx / сеть / таймаут по-прежнему ретраятся.

## 6.5. Рецепт по каждой границе

### Граница A (Prisma → приложение) — сделано правильно
`PrismaExceptionFilter` ловит `@Catch(PrismaClientKnownRequestError)`, маппит по **коду**
(не по тексту) и ветвится по миру (`libs/common/src/prisma/prisma-exception.filter.ts`).
Это эталон для проекта.

### Граница B (домен → транспорт) — прагматично, но пахнет
`SignInUserUseCase` бросает `UnauthorizedException`, `DeletePostUseCase` —
`NotFoundException`. Работает, но домен теперь знает про HTTP. «Чисто» — бросать доменный
`InvalidCredentialsError`, а `HttpException` лепить на границе. Для масштаба этого проекта —
терпимо; знать об этом стоит.

### Граница C (RPC сервер → клиент) — исправлено (P1)
**Было:** files бросал `HttpException` внутри `@MessagePattern`, и дефолтный RPC-фильтр
стирал статус до `{ status:'error', message:'Internal server error' }`.

**Стало:** `libs/common/src/rpc/http-to-rpc-exception.filter.ts` — `HttpToRpcExceptionFilter`
(`@Catch(HttpException)`), зарегистрирован как `APP_FILTER` в
`apps/files-microservice/src/app.module.ts`. Он переводит `HttpException` → `RpcException`
с каноническим payload, сохраняя `statusCode`:

```ts
@Catch(HttpException)
export class HttpToRpcExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): unknown {
    switch (host.getType<GqlContextType>()) {
      case 'graphql':
        throw exception;                              // отдаём formatError
      case 'rpc': {
        const body = exception.getResponse();
        const raw = typeof body === 'string' ? { message: body } : body;
        const errors = (raw as { errors?: RpcErrorField[] | null }).errors;
        const payload: RpcErrorPayload = {
          statusCode: exception.getStatus(),          // ← машинный статус сохранён
          message: /* из raw.message или exception.message */ '',
          ...(errors !== undefined ? { errors } : {}),
        };
        return throwError(() => new RpcException(payload));
      }
      default: /* http — как в PrismaExceptionFilter */
    }
  }
}
```

Фильтр повторяет паттерн `PrismaExceptionFilter` (ветвление по `host.getType()`), а
`RpcException` не трогает — поэтому `createRpcValidationPipe` с `statusCode: 400` идёт мимо
него как есть.

### Граница D (RPC-клиент → локальный мир) — исправлено (P2)
**Было:** `switch` в `mapRpcErrorToHttpException` знал только 400/401/403/404/409, и
серверные 500/504 уезжали в `default → 503`.

**Стало:** добавлены кейсы (плюс тип читается из `@app/contracts`):

```ts
case 500: return new InternalServerErrorException(message ?? `${label} error`);
case 504: return new GatewayTimeoutException(message ?? `${label} timeout`);
```

Принцип: список кейсов маппера = множество статусов, которые сервер реально эмитит.
Меняется сервер — синхронно правится маппер.

### Границы E/F (formatError) — сделано правильно, с идемпотентностью
Хороший пример правильной границы: единая функция, один формат, повторный проход безопасен.

### Границы G/H (аутентификация) — сделано правильно
`PicboardDataSource` кладёт машинно-читаемые заголовки, middleware сравнивает секрет — обе
стороны работают с явным контрактом, а не с «магией».

## 6.6. Чек-лист для любой новой границы

1. **Назовите границу.** Что пересекает: процесс? мир? слой?
2. **Зафиксируйте контракт payload** (в `@app/contracts`), машинно-читаемый:
   `{ statusCode, message, errors? }`.
3. **Точка перевода — одна на каждой стороне**, на входе в свой мир.
4. **Явно перечислите все статусы** (exhaustive `switch`) + осознанный fallback.
5. **Fallback ловит «всё неизвестное»** в понятный код (обычно 503), но **лог причины
   сохраните** на стороне перевода.
6. **Инвариант:** наружу не выходит `Error`/сырой транспортный объект.
7. **Идемпотентность**, если граница проходится повторно (субграф↔гейтвей).
8. **Классификация** 4xx (не ретраить) / 5xx (ретраить).
9. **Тест на границу:** бросили X справа — справа/слева видят ровно Y.

## 6.7. Сквозной прогон: как выглядит «правильно» на одной ошибке

Возьмём таймаут БД в files и прогоним через все границы, показывая payload на каждой:

| Точка | Представление ошибки |
| --- | --- |
| files handler | `GatewayTimeoutException('Files repository request timed out')` |
| граница C (RPC-фильтр) | `RpcException{ statusCode:504, message:'...timed out' }` |
| провод TCP | `{ statusCode:504, message:'...timed out' }` |
| граница D (маппер) | `GatewayTimeoutException('...timed out')` |
| субграф formatError | `{ message:'...', extensions:{ code:'GATEWAY_TIMEOUT', statusCode:504 } }` |
| гейтвей formatError | тот же (идемпотентно) |
| клиент | `504 GATEWAY_TIMEOUT` |

После правок P1–P3 цепочка замкнута на всех границах, и клиент получает `504
GATEWAY_TIMEOUT` с осмысленным текстом. До правок выпадали границы C и D — на выходе
получался `503` с текстом `Internal server error`.

## 6.8. Анти-паттерны: статус

**Закрыто правками P1–P3:**

| Анти-паттерн | Где было | Чем закрыт |
| --- | --- | --- |
| `HttpException` в RPC-хендлере | `check-owned-ready-files.handler.ts` | P1 — `HttpToRpcExceptionFilter` |
| Маппер знает не все статусы | `map-rpc-error-to-http.ts` | P2 — добавлены 500/504 |
| Контракт payload на клиенте | `map-rpc-error-to-http.ts` | вынесен в `@app/contracts` |
| Ретрай без классификации | `file-deletion-outbox.worker.ts` | P3 — `isPermanentFailure` |

**Осталось (осознанно не трогали):**

| Анти-паттерн | Где | Комментарий |
| --- | --- | --- |
| Домен бросает HTTP-исключения | `sign-in-user.use.case.ts` и др. | связанность домен↔HTTP; для текущего масштаба терпимо |

---

# Резюме

**Граница ломается, когда через неё пытаются протащить «как есть» то, что на другой
стороне имеет другой смысл.** Правильный подход — **один канонический payload, ровно одна
точка перевода на каждой стороне, полный список статусов, сохранение машинного кода и лог
причины, идемпотентность при повторных проходах.** Тогда `GatewayTimeoutException` в files
прилетит на фронт как `504`, а не как безымянный `503`.

После применения правок P1–P3 границы C и D замкнуты, а общий контракт `RpcErrorPayload`
живёт в `@app/contracts`: статус ошибки доезжает от `files` до фронта без потерь.

---

# Приложение A. Применённые правки (P1–P3)

Контекст: PR #26 «Rpc exceptions handling» (ветка `rpcExceptionsHandling`).

## Новые файлы

| Файл | Назначение |
| --- | --- |
| `libs/contracts/src/rpc/rpc-error-payload.ts` | типы `RpcErrorPayload` / `RpcErrorField` — общий контракт payload |
| `libs/common/src/rpc/http-to-rpc-exception.filter.ts` | P1: `HttpException → RpcException` на RPC-границе |
| `libs/common/src/rpc/http-to-rpc-exception.filter.spec.ts` | тесты фильтра |
| `md-files/error-handling-flow.md` | этот документ |

## Изменённые файлы

| Файл | Изменение |
| --- | --- |
| `libs/contracts/src/index.ts` | экспорт `rpc-error-payload` |
| `libs/common/src/index.ts` | экспорт `HttpToRpcExceptionFilter` |
| `libs/common/src/rpc/map-rpc-error-to-http.ts` | P2: тип из `@app/contracts`; кейсы `500` / `504` |
| `libs/common/src/validation/create-rpc-validation-pipe.ts` | payload типизирован `RpcErrorPayload` |
| `apps/files-microservice/src/app.module.ts` | регистрация `HttpToRpcExceptionFilter` как `APP_FILTER` |
| `apps/posts-microservice/src/infrastructure/worker/file-deletion-outbox.worker.ts` | P3: `isPermanentFailure` — 4xx → сразу `FAILED` |
| `libs/common/src/rpc/map-rpc-error-to-http.spec.ts` | тесты `500` / `504` |
| `apps/posts-microservice/src/infrastructure/worker/file-deletion-outbox.worker.spec.ts` | тесты 4xx / 5xx |

## Что дают правки

- **P1** — файловый сервис больше не теряет статус на TCP-границе: `HttpException` из
  `CheckOwnedReadyFilesHandler` (504 / 503 / 500) превращается в `RpcException` с `statusCode`.
- **P2** — клиентский маппер понимает `500` и `504`, а не уводит их в ложный `503`.
- **P3** — воркер не тратит попытки на перманентные 4xx.
- **Контракт** — `RpcErrorPayload` вынесен в `@app/contracts`; обе стороны используют один тип.

## Проверка

```
pnpm build:files && pnpm build:posts    # сборка
pnpm test                               # 9 suites / 46 tests passed
```

## Осознанно не трогали

- `markFilesDeleted` — намеренно пробрасывает сырую ошибку (зафиксировано тестом), а воркер
  читает `statusCode` из «сырого» payload.
- Граница B (домен бросает `HttpException`) — для текущего масштаба оставлено как есть.
