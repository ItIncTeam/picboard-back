# План разработки авторизации — picboard-back

## Общая архитектура

### Принципы
1. **Единая точка входа:** все auth-запросы идут через `users-microservice`.
2. **OAuth-ready с первого дня:** модель `OAuthAccount` уже есть в Prisma. Все новые сущности (токены, сессии) проектируются так, чтобы не зависеть от способа аутентификации (password vs OAuth).
3. **JWT access + refresh:** access — короткий (15 мин), передаётся в `Authorization: Bearer`. Refresh — долгий (7 дней), хранится в httpOnly cookie + в БД (модель `RefreshToken`).
4. **Сессии:** refresh-токен = сессия. При сбросе пароля / logout — удаляем все refresh-токены пользователя.
5. **Подтверждение email:** обязательно перед первым логином. Код — одноразовый, 1 час жизни.

### Схема БД (изменения в `prisma/users/schema.prisma`)

```prisma
// Существующее — не трогаем
model User { ... }
model OAuthAccount { ... }

// НОВОЕ
model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  token     String   @unique          // сам refresh-токен (хеш)
  userId    String   @db.Uuid
  device    String?                   // user-agent / device name
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model EmailConfirmation {
  id        String   @id @default(uuid()) @db.Uuid
  code      String   @unique          // UUID-код из ссылки
  userId    String   @db.Uuid
  expiresAt DateTime @db.Timestamptz(6)
  usedAt    DateTime? @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id        String   @id @default(uuid()) @db.Uuid
  code      String   @unique
  userId    String   @db.Uuid
  expiresAt DateTime @db.Timestamptz(6)
  usedAt    DateTime? @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Замечание:** текущие поля `confirmationCode` и `confirmationCodeExpDate` на модели `User` — удалить после миграции на `EmailConfirmation`.

---

## Фазы разработки

### Фаза 1: База — рефакторинг текущего кода (1-2 дня)

**Задача:** починить критическое, унифицировать архитектуру, подготовить почву для новых фич.

| # | Задача | Файлы |
|---|--------|-------|
| 1.1 | Исправить хардкод `'123456'` в `login()` | `users.service.ts` |
| 1.2 | Починить `sendEmail` (добавить `await`, правильный error handling) | `sign-up-user.use.case.ts` |
| 1.3 | Доделать `SignInUserUseCase` через CQRS (аналог `SignUpUserUseCase`) | `application/use-cases/sign-in-user/` |
| 1.4 | Перенести `me()` в CQRS: `GetCurrentUserUseCase` | новый файл |
| 1.5 | Удалить старый `UsersService.login()` и `UsersService.me()` после переноса | `users.service.ts` |
| 1.6 | Починить e2e тесты (правильные имена mutation: `signUp`, `login`) | `test/app.e2e-spec.ts` |
| 1.7 | Вычистить закомментированный код | все затронутые файлы |

**Результат:** единый CQRS-стиль, все auth-операции через use-case → domain-интерфейсы. База готова к расширению.

---

### Фаза 2: Email Confirmation (2-3 дня)

**Спецификация:** п. 1.1.6 – 1.1.10

| # | Задача | Детали |
|---|--------|--------|
| 2.1 | Создать модель `EmailConfirmation` в Prisma + миграция | Отдельная таблица, не поле на User |
| 2.2 | `CreateEmailConfirmationUseCase` | Генерация кода, сохранение в БД, отправка письма |
| 2.3 | `ConfirmEmailUseCase` | Поиск по коду, проверка `expiresAt` и `usedAt`, установка `usedAt` + `user.isConfirmed = true` |
| 2.4 | `ResendConfirmationEmailUseCase` | По `userId` найти неиспользованный код. Если истёк — создать новый |
| 2.5 | Обновить `SignUpUserUseCase` | Использовать `CreateEmailConfirmationUseCase` вместо прямой генерации кода на User |
| 2.6 | Мутация `confirmEmail(code: String!)` | GraphQL resolver |
| 2.7 | Мутация `resendConfirmationEmail(userId: String!)` | GraphQL resolver |
| 2.8 | Запрет логина без подтверждённого email | Проверка `isConfirmed` в `SignInUserUseCase` |
| 2.9 | Удалить поля `confirmationCode` / `confirmationCodeExpDate` с модели User | Миграция после переноса |

**Результат:** полный цикл подтверждения email, нельзя войти без подтверждения.

---

### Фаза 3: Refresh Token + Сессии (2-3 дня)

| # | Задача | Детали |
|---|--------|--------|
| 3.1 | Создать модель `RefreshToken` в Prisma + миграция | |
| 3.2 | `TokenService` — расширить интерфейс | Добавить `signRefreshToken`, `verifyRefreshToken` |
| 3.3 | `JwtTokenService` — реализовать refresh | Два разных секрета: `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` |
| 3.4 | `CreateRefreshTokenUseCase` | Генерация JWT + сохранение в БД |
| 3.5 | `RotateRefreshTokenUseCase` | Проверить старый, удалить, создать новый (ротация) | (может лучше проверять в guard и выдать новый в CreateRefreshTokenUseCase если все ок?)
| 3.6 | `RevokeRefreshTokensUseCase` | Удалить все refresh-токены пользователя (logout, сброс пароля) | 
| 3.7 | Обновить `SignInUserUseCase` | Возвращать и access, и refresh. Refresh — в httpOnly cookie |
| 3.8 | Мутация `refreshToken` | Принимает refresh из cookie, возвращает новый access + ротирует refresh |
| 3.9 | Обновить `AppConfig` | Добавить `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
 
**Результат:** полноценная JWT-аутентификация с безопасной ротацией токенов.

---

### Фаза 4: Logout (1 день)

**Спецификация:** п. 1.4

| # | Задача | Детали |
|---|--------|--------|
| 4.1 | `LogOutUserUseCase` | Удалить refresh-токен из БД по значению из cookie |
| 4.2 | Мутация `logout` | GraphQL resolver |
| 4.3 | Gateway — очистка refresh cookie | При logout — `Set-Cookie` с `Max-Age=0` |

**Результат:** logout через удаление refresh-токена.

---

### Фаза 5: Password Recovery (3-4 дня)

**Спецификация:** п. 1.3

| # | Задача | Детали |
|---|--------|--------|
| 5.1 | Создать модель `PasswordResetToken` в Prisma + миграция | |
| 5.2 | `RequestPasswordResetUseCase` | Проверить email, сгенерировать код, сохранить, отправить письмо |
| 5.3 | `ResetPasswordUseCase` | Проверить код (expiresAt, usedAt), хешировать новый пароль, сохранить, пометить код использованным |
| 5.4 | Сброс сессий при смене пароля | Внутри `ResetPasswordUseCase` вызвать `RevokeRefreshTokensUseCase` |
| 5.5 | Мутация `requestPasswordReset(email: String!)` | GraphQL resolver |
| 5.6 | Мутация `resetPassword(code: String!, newPassword: String!)` | GraphQL resolver |
| 5.7 | Обработка истёкшего кода | Возврат ошибки с возможностью запросить новый код |
| 5.8 | Обработка несуществующего email | Не раскрывать, зарегистрирован email или нет. Всегда показывать «если email существует, мы отправили ссылку» |

**Результат:** полный цикл восстановления пароля со сбросом всех сессий.

---

### Фаза 6: Rate Limiting (1 день)

| # | Задача | Детали |
|---|--------|--------|
| 6.1 | Установить `@nestjs/throttler` | |
| 6.2 | Rate-limit на `signUp` | 5 попыток в минуту с одного IP |
| 6.3 | Rate-limit на `login` | 10 попыток в минуту с одного IP |
| 6.4 | Rate-limit на `requestPasswordReset` | 3 попытки в минуту с одного IP |
| 6.5 | Rate-limit на `resendConfirmationEmail` | 1 попытка в минуту |

**Результат:** защита от брутфорса.

---

### Фаза 7: OAuth — Google + GitHub (6-9 часов)

**Ключевое:** модель `OAuthAccount` уже есть, 2 миграции накачены. `User.passwordHash` nullable — OAuth-юзеры без пароля. `SignInUserUseCase` уже блокирует password-login для OAuth-аккаунтов.

---

#### Шаг 1. Установить пакеты

```bash
npm install passport-google-oauth20 passport-github2
npm install -D @types/passport-google-oauth20 @types/passport-github2
```

`@nestjs/axios` не нужен — Passport сам ходит за токенами.

---

#### Шаг 2. Конфиг + env

**`apps/users-microservice/src/config/app.config.ts`** — добавить геттеры:

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL      → https://users.picboard.space/api/v1/auth/google/callback
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_CALLBACK_URL      → https://users.picboard.space/api/v1/auth/github/callback
OAUTH_SUCCESS_REDIRECT   → https://picboard.space
```

**`apps/users-microservice/src/env/.env.development`** — прописать тестовые credentials.

---

#### Шаг 3. REST-контроллеры в users-microservice

OAuth работает через HTTP redirect, а не GraphQL. Нужен Express-контроллер:

```
apps/users-microservice/src/
└── infrastructure/
    └── oauth/
        ├── google-oauth.controller.ts    — GET /api/v1/auth/google/login
        │                                     GET /api/v1/auth/google/callback
        ├── github-oauth.controller.ts    — GET /api/v1/auth/github/login
        │                                     GET /api/v1/auth/github/callback
        └── oauth.module.ts               — @Module, регистрирует контроллеры
```

**google-oauth.controller.ts:**

| Endpoint | Что делает |
|----------|-----------|
| `GET /auth/google/login` | Редирект на Google: `/o/oauth2/auth?client_id=...&redirect_uri=...` |
| `GET /auth/google/callback?code=xxx` | Обменивает code на access_token → запрос `/userinfo` → OAuthLoginUseCase → Set-Cookie с refreshToken → редирект на фронт |

Аналогично для GitHub.

---

#### Шаг 4. OAuth use case

```
apps/users-microservice/src/
└── application/
    └── use-cases/
        └── oauth-login/
            ├── oauth-login.use-case.ts
            └── oauth-login.result.ts
```

**Логика `OAuthLoginUseCase`:**

```
1. OAuthAccount.findByProvider(provider, providerId)
   │
   ├── Найден → login (выдать JWT)
   │
   └── Не найден
       │
       ├── 2. Ищем User по email
       │   │
       │   ├── Email свободен → создать User + OAuthAccount (email auto-confirmed)
       │   │
       │   └── Email занят → ошибка "this email is already registered"
       │
       └── 3. Выдать accessToken + refreshToken (переиспользуем CreateRefreshTokenCommand)
            4. Установить httpOnly cookie
```

---

#### Шаг 5. Подключить в Gateway

Gateway форвардит REST-запросы в users-microservice. Вариант A — через proxy:

```typescript
// apps/gateway/src/main.ts
import { createProxyMiddleware } from 'http-proxy-middleware';

app.use(
  '/auth/google',
  createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }),
);
app.use(
  '/auth/github',
  createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }),
);
```

Вариант B — через `@nestjs/axios` внутри `OAuthModule`.

---

#### Схема flow

```
Браузер                    Gateway                    users-microservice
  │                           │                           │
  │ GET /auth/google/login    │                           │
  │──────────────────────────►│──302→ google.com/oauth…   │
  │◄── 302 Location: google ──│                           │
  │                           │                           │
  │ (согласие пользователя)   │                           │
  │                           │                           │
  │ GET /auth/google/callback?code=xxx                    │
  │──────────────────────────►│──► /api/v1/auth/google… ─►│
  │                           │                           │
  │                           │   1. code → token         │
  │                           │   2. token → /userinfo    │
  │                           │   3. OAuthLoginUseCase    │
  │                           │   4. Set-Cookie: jwt      │
  │                           │◄──────────────────────────│
  │◄── 302 → https://picboard.space ──────────────────────│
  │                           │                           │
  │ Теперь браузер имеет httpOnly cookie с refreshToken   │
  │ Может делать GraphQL-запросы с этим cookie            │
```

---

#### Что уже готово (не трогать)

- ✅ `OAuthAccount` модель в Prisma + 2 миграции
- ✅ `User.passwordHash` nullable — OAuth-юзеры без пароля
- ✅ `SignInUserUseCase` — блокирует password-login для OAuth
- ✅ JWT access token (`JwtTokenService`)
- ✅ Refresh token + httpOnly cookie (`CreateRefreshTokenCommand`)
- ✅ `RotateRefreshTokenUseCase` — ротация токенов
- ✅ `LogOutUserUseCase` — logout
- ✅ `GqlJwtAuthGuard` + `JwtStrategy` — защита endpoint-ов

---

#### Оценка

| Шаг | Часы |
|-----|------|
| 1. Установка пакетов | 0.1 |
| 2. Конфиг + env | 0.5 |
| 3. REST-контроллеры + use case | 4-6 |
| 4. Интеграция с Gateway | 1-2 |
| **Итого** | **~6-9** |

---

## Итоговая структура модулей (после всех фаз)

```
apps/users-microservice/src/
├── domain/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── repositories/
│   │   ├── users.repository.ts          // + findByConfirmationCode, findRefreshToken, ...
│   │   ├── refresh-token.repository.ts  // новый
│   │   ├── email-confirmation.repository.ts  // новый
│   │   └── password-reset.repository.ts // новый
│   ├── services/
│   │   ├── password-hasher.ts
│   │   ├── token.service.ts             // расширен: signAccess, signRefresh, verifyRefresh
│   │   └── email.service.ts             // абстракция над отправкой (замена EmailAdapter)
│   └── errors/
│       ├── email-already-taken.error.ts
│       ├── username-already-taken.error.ts
│       ├── invalid-credentials.error.ts
│       ├── email-not-confirmed.error.ts
│       ├── confirmation-code-expired.error.ts
│       └── invalid-refresh-token.error.ts
├── application/use-cases/
│   ├── sign-up-user/
│   ├── sign-in-user/                     // доделать
│   ├── get-current-user/                 // новый
│   ├── confirm-email/                    // новый
│   ├── resend-confirmation-email/        // новый
│   ├── refresh-token/                    // новый
│   ├── log-out-user/                     // доделать
│   ├── request-password-reset/           // новый
│   ├── reset-password/                   // новый
│   ├── oauth-login/                      // новый (фаза 7)
│   └── link-oauth-account/              // новый (фаза 7)
├── infrastructure/
│   ├── prisma/
│   │   ├── prisma-users.repository.ts
│   │   ├── prisma-refresh-token.repository.ts     // новый
│   │   ├── prisma-email-confirmation.repository.ts // новый
│   │   └── prisma-password-reset.repository.ts     // новый
│   ├── security/
│   │   ├── bcrypt-password-hasher.ts
│   │   └── jwt-token.service.ts
│   ├── messaging/
│   │   └── nodemailer-email.service.ts   // новый (реализация EmailService)
│   └── oauth/
│       ├── google-oauth.strategy.ts      // новый (фаза 7)
│       └── github-oauth.strategy.ts      // новый (фаза 7)
└── graphql/
    ├── resolvers/
    │   ├── auth.resolver.ts              // signUp, confirmEmail, resendConfirmation
    │   ├── auth-password.resolver.ts     // requestPasswordReset, resetPassword
    │   └── auth-session.resolver.ts      // login, refreshToken, logout, me
    ├── inputs/
    │   ├── sign-up.input.modelsts
    │   ├── sign-in.input.modelsts
    │   ├── confirm-email.input.modelsts
    │   ├── request-password-reset.input.modelsts
    │   └── reset-password.input.modelsts
    └── types/
        ├── user.type.ts
        ├── login-payload.type.ts         // accessToken + refreshToken + user
        └── sign-up-payload.type.ts
```

---

## Зависимости между фазами

```
Фаза 1 (база) ──┬──► Фаза 2 (email confirmation)
                │
                ├──► Фаза 3 (refresh token) ──► Фаза 4 (logout)
                │                                      │
                └──► Фаза 5 (password recovery) ◄──────┘
                
Фаза 6 (rate limiting) — независима, можно в любой момент после фазы 1

Фаза 7 (OAuth) — после фазы 3 (нужны refresh-токены и унифицированный логин)
```

---

## Что уже реализовано (не переделывать)

- `JwtStrategy` + `GqlJwtAuthGuard` — работают, используются
- `BcryptPasswordHasher`, `JwtTokenService` — интерфейсы + реализации готовы
- `UsersRepository` / `PrismaUsersRepository` — готовы, нужно расширить методы
- `SignUpUserUseCase` — основа готова, рефакторинг в фазе 1-2
- Валидация через `class-validator` — покрывает все поля из spec
- `createGraphqlFormatError` — обработка ошибок готова
- Модель `OAuthAccount` + миграция — уже в БД, код не тронут (будет в фазе 7)

---

## Оценка по времени (backend)

| Фаза | Часы |
|------|------|
| 1. База (рефакторинг) | 12-16 |
| 2. Email Confirmation | 16-24 |
| 3. Refresh Token + Сессии | 16-24 |
| 4. Logout | 6-8 |
| 5. Password Recovery | 20-28 |
| 6. Rate Limiting | 6-8 |
| 7. OAuth (Google + GitHub) | 6-9 |
| **Итого (backend)** | **82-121** |

---

## Мультидевайсность (управление сессиями)

### Текущий статус

Базовая мультидевайсность **уже работает**. При логине создаётся новый `RefreshToken` в БД. Старые токены не удаляются — оба устройства остаются активными.

`RefreshTokenRepository.deleteAllByUserId()` реализован, но **не вызывается** нигде, кроме `deleteAllByUserId` в репозитории.

В модели `RefreshToken` есть поле `device`, но оно **не заполняется** — `signIn` и `refreshToken` не передают `user-agent`.

---

### Что добавить (3 подзадачи)

#### 1. Заполнять device при создании токена

**`auth.resolver.ts` — signIn и refreshToken:**

```typescript
const device = context.req.headers['user-agent'] ?? 'unknown';
const refreshToken = await this.commandBus.execute(
  new CreateRefreshTokenCommand(user.id, user.email, device),
);
```

То же самое в `refreshToken` мутации.

---

#### 2. Query — список активных сессий

```graphql
query {
  mySessions {
    id
    device
    createdAt
    expiresAt
    isCurrent
  }
}
```

Нужно:

| Компонент | Файл |
|-----------|------|
 | Тип `Session` | `graphql/types/session.type.ts` |
 | `GetSessionsQuery` | `application/use-cases/get-sessions/get-sessions.use-case.ts` |
 | `SessionsResolver` | `graphql/resolvers/sessions.resolver.ts` |

Логика use case: `RefreshTokenRepository.findAllByUserId(userId)` → возвращает список. Текущая сессия определяется сравнением `token` (с хэшем) с переданным refreshToken из cookie.

---

#### 3. Mutation — отзыв сессии

```graphql
mutation {
  revokeSession(sessionId: "uuid")
}

mutation {
  revokeOtherSessions
}
```

Нужно:

| Компонент | Файл |
|-----------|------|
| `RevokeSessionUseCase` | `application/use-cases/revoke-session/revoke-session.use-case.ts` |
| `RevokeOtherSessionsUseCase` | `application/use-cases/revoke-other-sessions/revoke-other-sessions.use-case.ts` |
| Добавить метод в репозиторий | `RefreshTokenRepository.deleteById(id)` |
| Реализация `deleteById` в Prisma | `PrismaRefreshTokenRepository.deleteById(id)` |

**Важно:** `revokeOtherSessions` должен удалить все сессии пользователя, кроме текущей (токен из httpOnly cookie).

---

### Порядок реализации

```
1. Заполнять device     — 0.5 часа (только auth.resolver.ts)
2. Query mySessions     — 2-3 часа (type + use case + resolver)
3. Mutation revokeSession — 1-2 часа
```

Не блокирует OAuth — можно делать после.

---

## Рефакторинг OAuth (добавить как Фазу 8)

### Текущая проблема

Логика дублируется между GitHub и Google контроллерами:

| Операция | GitHub | Google |
|----------|--------|--------|
| state (CSRF) | ✅ в контроллере | ✅ в контроллере |
| PKCE | — | ✅ в контроллере |
| exchangeCode (API) | ✅ `GithubOAuthService` | ✅ `CompleteGoogleOAuthUseCase` |
| getUserProfile | ✅ `GithubOAuthService` | ✅ `CompleteGoogleOAuthUseCase` |
| login/register | ✅ `OAuthLoginUseCase` | ✅ `CompleteGoogleOAuthLoginUseCase` |
| create exchangeCode | ✅ `CreateOAuthExchangeCodeCommand` | ✅ `CreateOAuthExchangeCodeCommand` |
| redirect | ✅ в контроллере | ✅ в контроллере |

---

### Цель

```
Контроллеры (тонкие)
  └→ OAuthService (оркестратор)
       ├→ GithubOAuthProvider / GoogleOAuthProvider (API-вызовы)
       └→ Use Cases (бизнес-логика)
```

---

#### Шаг 1. Создать OAuthProvider — абстракцию для API провайдера

```typescript
// domain/services/oauth-provider.ts
export abstract class OAuthProvider {
  abstract getLoginUrl(state: string, verifier?: string): string;
  abstract exchangeCode(code: string, verifier?: string): Promise<string>;
  abstract getUserProfile(token: string): Promise<OAuthUserProfile>;
}

export type OAuthUserProfile = {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
};
```

Две реализации:

```
infrastructure/oauth/providers/
  ├── github-oauth.provider.ts    — GitHub API
  └── google-oauth.provider.ts    — Google API + PKCE
```

В каждом:
- `getLoginUrl()` — формирует URL с параметрами (scope, state, code_challenge и т.д.)
- `exchangeCode()` — обмен code на access_token
- `getUserProfile()` — запрос профиля (с проверкой verified email)

---

#### Шаг 2. Создать OAuthService — оркестратор

```typescript
// infrastructure/oauth/oauth.service.ts
@Injectable()
export class OAuthService {
  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  async handleCallback(
    provider: OAuthProvider,
    code: string,
  ): Promise<{ redirectUrl: string }> {
    // 1. Обмен code на токен → профиль
    const token = await provider.exchangeCode(code);
    const profile = await provider.getUserProfile(token);

    if (!profile.emailVerified) {
      return { redirectUrl: '/auth/callback?error=unverified_email' };
    }

    // 2. Логин или регистрация
    const loginResult = await this.commandBus.execute(
      new OAuthLoginCommand(
        profile.provider,
        profile.providerId,
        profile.email,
        profile.name ?? profile.email.split('@')[0],
        profile.avatarUrl,
      ),
    );

    // 3. Генерация exchangeCode
    const exchangeCode = await this.commandBus.execute(
      new CreateOAuthExchangeCodeCommand({
        userId: loginResult.userId,
        provider: profile.provider,
      }),
    );

    return {
      redirectUrl: `/auth/callback?code=${encodeURIComponent(exchangeCode.code)}`,
    };
  }
}
```

---

#### Шаг 3. Упростить контроллеры

```typescript
// infrastructure/oauth/github-oauth.controller.ts
@Controller('api/v1/auth/github')
export class GitHubOAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly githubProvider: GithubOAuthProvider,
  ) {}

  @Get('login')
  login(@Res() res: Response): void {
    const state = randomUUID();
    res.cookie('oauth_state', state, { httpOnly: true, ... });
    res.redirect(this.githubProvider.getLoginUrl(state));
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // CSRF проверка state
    const result = await this.oauthService.handleCallback(
      this.githubProvider,
      code,
    );
    res.redirect(`${this.appConfig.frontendUrl}${result.redirectUrl}`);
  }
}
```

---

#### Шаг 4. Что станет с текущими файлами

| Файл | Действие |
|------|----------|
| `GithubOAuthService` (текущий) | Разделить на `GithubOAuthProvider` (API) и `OAuthService` (оркестрация) |
| `GithubOAuthController` | Упростить до вызова OAuthService |
| `GoogleOAuthController` | Упростить до вызова OAuthService + PKCE |
| `OAuthLoginUseCase` | Оставить, уже универсален |
| `CreateOAuthExchangeCodeUseCase` | Оставить, уже универсален |
| `oauth.module.ts` | Добавить провайдеры |

---

#### Схема после рефакторинга

```
GitHubOAuthController
  └─ OAuthService.handleCallback(githubProvider, code)
       ├─ githubProvider.exchangeCode(code)
       ├─ githubProvider.getUserProfile(token)
       ├─ OAuthLoginUseCase
       └─ CreateOAuthExchangeCodeUseCase

GoogleOAuthController
  └─ OAuthService.handleCallback(googleProvider, code, verifier)
       ├─ googleProvider.exchangeCode(code, verifier)
       ├─ googleProvider.getUserProfile(token)
       ├─ OAuthLoginUseCase
       └─ CreateOAuthExchangeCodeUseCase
```

---

#### Оценка

| Шаг | Часы |
|-----|------|
| 1. OAuthProvider + реализации (GitHub/Google) | 2-3 |
| 2. OAuthService (оркестратор) | 1 |
| 3. Упрощение контроллеров | 1 |
| 4. Тесты | 1 |
| **Итого** | **~5-6 ч** |
