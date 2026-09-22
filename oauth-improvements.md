# OAuth — улучшения для production

## Текущий статус

GitHub OAuth реализован. Google — нет. Что уже готово:

- ✅ `GithubOAuthService` — HTTP-вызовы к GitHub API (exchangeCode, getUserProfile)
- ✅ `GitHubOAuthController` — REST endpoints: `/auth/github/login`, `/auth/github/callback`
- ✅ `OAuthLoginUseCase` — поиск/создание пользователя, выдача JWT, установка httpOnly cookie
- ✅ `OAuthAccount` модель в Prisma + 2 миграции
- ✅ Access token **не передаётся** в URL редиректа (только httpOnly cookie)
- ✅ Обработка ошибок с редиректом на фронт (`?error=`)

---

## Что нужно исправить (production-ready)

### 🔴 P0 — CSRF (state параметр)

**Проблема:** Злоумышленник может отправить жертве ссылку:
```
https://api.site.com/auth/github/callback?code=attacker_code
```
Если жертва авторизована — GitHub аккаунт злоумышленника привяжется к аккаунту жертвы.

**Решение:**

```typescript
// login — генерируем и сохраняем state
@Get('login')
login(@Req() req: Request, @Res() res: Response): void {
  const state = randomUUID();
  // сохранить state в Redis/БД с TTL 10 минут
  await this.tempStorage.set(`oauth:state:${state}`, true, 600);

  const url = `https://github.com/login/oauth/authorize?...&state=${state}`;
  res.redirect(url);
}

// callback — проверяем state
@Get('callback')
async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
  const state = req.query.state as string;
  const isValid = await this.tempStorage.get(`oauth:state:${state}`);
  if (!isValid) {
    return res.redirect(`${frontend}?error=invalid_state`);
  }
  await this.tempStorage.del(`oauth:state:${state}`);
  // ... дальше по коду
}
```

**Варианты хранилища для state (выбрать один):**

| Хранилище | Плюсы | Минусы |
|-----------|-------|--------|
| Redis (отдельный) | Быстро, TTL встроен | Нужен Redis |
| Тот же PostgreSQL | Не нужен новый сервис | Медленнее, нужно чистить |
| `@nestjs/session` | Просто | Stateful, не масштабируется |

---

### 🟡 P1 — Auto-link при конфликте email ✅ Безопасно

**Статус:** Не требует исправления.

При конфликте email — OAuth аккаунт привязывается к существующему пользователю. Это **безопасно**, потому что:

1. `GithubOAuthService.getUserProfile()` проверяет `verified: true` через `/user/emails`
2. GitHub сам требует верификации email при регистрации
3. Если атакующий имеет доступ к email жертвы — сайт скомпрометирован и без OAuth (через password reset)

Сценарий «зарегистрировался через email, потом захотел заходить через GitHub» — работает и должен работать.

---

### 🟡 P2 — Логирование

Добавить структурные логи для аудита:

```typescript
// Успешный вход
this.logger.log({
  event: 'oauth_login',
  provider: 'github',
  userId: user.id,
  isNewUser,
  ip: req.ip,
});

// Ошибка
this.logger.warn({
  event: 'oauth_error',
  provider: 'github',
  error: error.message,
  ip: req.ip,
});

// Конфликт email
this.logger.warn({
  event: 'oauth_email_conflict',
  provider: 'github',
  email,
});
```

---

### 🟢 P3 — Rate limiting

| Endpoint | Лимит | Причина |
|----------|-------|---------|
| `GET /auth/github/callback` | 10 запросов/мин с IP | Перебор code |
| `GET /auth/github/login` | 5 запросов/мин с IP | Защита от CSRF-спама |

Через `@nestjs/throttler` (после установки пакета).

---

### 🟢 P4 — Окружения

Для локальной разработки и продакшена нужны **разные GitHub OAuth Apps** (у каждого свой `client_id`/`client_secret` и `callback_url`).

```
.env.development
  GITHUB_CLIENT_ID=dev_client_id
  GITHUB_CALLBACK_URL=http://localhost:3001/api/v1/auth/github/callback

.env.production
  GITHUB_CLIENT_ID=prod_client_id
  GITHUB_CALLBACK_URL=https://api.picboard.space/auth/github/callback
```

---

## План добавления Google OAuth

Когда понадобится Google — нужно создать:

```
src/infrastructure/oauth/
├── oauth.module.ts                     ← уже есть, добавить providers/controllers
├── github-oauth.controller.ts           ← уже есть
├── github-oauth.service.ts              ← уже есть
├── google-oauth.controller.ts           ← новый (аналог github)
├── google-oauth.service.ts              ← новый (API Google)
└── google-oauth.dto.ts                  ← типы ответов Google
```

**Google OAuth flow** отличается от GitHub:

| | GitHub | Google |
|---|---|---|
| Токен endpoint | `POST /login/oauth/access_token` | `POST /oauth2/v4/token` (та же схема) |
| Профиль endpoint | `GET /api.github.com/user` | `GET /oauth2/v2/userinfo` |
| Email | Опционально, может требовать доп. запрос | Всегда в профиле |
| Scope | `read:user user:email` | `openid profile email` |

Структура `GoogleOAuthService` повторяет `GithubOAuthService`. `OAuthLoginUseCase` переиспользуется — в него передаётся только provider имя и данные пользователя.

---

## Приоритеты

```
Сейчас:
  P0 CSRF (state)       — ~2-3 часа
  P1 auto-link          — ~0.5 часа
  P2 логи               — ~0.5 часа

Потом:
  P3 rate limiting      — ~1 час
  P4 Google OAuth       — ~2-3 часа
```
