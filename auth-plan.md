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

### Фаза 7: OAuth — Google + GitHub (4-5 дней)

**Ключевое:** модель `OAuthAccount` уже есть, миграция создана. Нужно реализовать flow.

| # | Задача | Детали |
|---|--------|--------|
| 7.1 | Установить `passport-google-oauth20` + `passport-github2` | |
| 7.2 | `GoogleOAuthStrategy` | Passport-стратегия для Google |
| 7.3 | `GithubOAuthStrategy` | Passport-стратегия для GitHub |
| 7.4 | `OAuthService` — универсальная логика | Поиск/создание пользователя по OAuth-данным |
| 7.5 | `LinkOAuthAccountUseCase` | Привязка OAuth к существующему аккаунту |
| 7.6 | `OAuthLoginUseCase` | Если `OAuthAccount` найден → логин. Если нет → создать User + OAuthAccount (email подтверждён автоматически) |
| 7.7 | Обработка конфликта email | Если email из OAuth уже занят другим пользователем — предложить привязать, а не создавать дубликат |
| 7.8 | REST endpoints для OAuth callback | `/auth/google/callback`, `/auth/github/callback` |
| 7.9 | Выдача JWT (access + refresh) после OAuth — переиспользовать логику фазы 3 | `OAuthLoginUseCase` внутри вызывает фабрику токенов |

**Результат:** вход через Google и GitHub, аккаунты связываются через `OAuthAccount`.

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
    │   ├── sign-up.input.ts
    │   ├── sign-in.input.ts
    │   ├── confirm-email.input.ts
    │   ├── request-password-reset.input.ts
    │   └── reset-password.input.ts
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
| 7. OAuth (Google + GitHub) | 28-36 |
| **Итого (backend)** | **104-144** |
