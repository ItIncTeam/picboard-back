# Posts API — Документация для фронтенда

> Версия: 1.0
> GraphQL endpoint (через gateway): `http://localhost:3000/graphql`

---

## Содержание

1. [Полный флоу создания поста](#1-полный-флоу-создания-поста)
2. [Шаг 1: Загрузка файлов (files-microservice)](#2-шаг-1-загрузка-файлов-files-microservice)
3. [Шаг 2: Создание поста (posts-microservice)](#3-шаг-2-создание-поста-posts-microservice)
4. [Редактирование поста](#4-редактирование-поста)
5. [Удаление поста](#5-удаление-поста)
6. [Просмотр своих постов (профиль)](#6-просмотр-своих-постов-профиль)
7. [Лента на главной](#7-лента-на-главной)
8. [Типы данных (GraphQL schema)](#8-типы-данных-graphql-schema)
9. [Auth](#9-auth)
10. [Ошибки](#10-ошибки)

---

## 1. Полный флоу создания поста

Создание поста состоит из 4 шагов:

```
  Фронтенд                           Files Service                  MinIO/S3              Posts Service
     │                                      │                          │                       │
     │──── 1. initiateUpload ──────────────>│                          │                       │
     │<──── { fileId, uploadUrl } ──────────│                          │                       │
     │                                      │                          │                       │
     │──── 2. PUT uploadUrl (file bytes) ─────────────────────────────>│                       │
     │                                      │                          │                       │
     │──── 3. completeUpload(fileId) ───────>│                          │                       │
     │<──── { status: READY } ──────────────│                          │                       │
     │                                      │                          │                       │
     │     (повторить шаги 1-3 для каждого файла, до 10)               │                       │
     │                                      │                          │                       │
     │──── 4. createPost(fileIds, description?) ───────────────────────────────────────────────>│
     │<──── PostModel ─────────────────────────────────────────────────────────────────────────│
```

**Важно:** все мутации, кроме `profilePosts` и `feed`, требуют JWT-токен в заголовке `Authorization: Bearer <token>`.

---

## 2. Шаг 1: Загрузка файлов (files-microservice)

### 2.1 Инициировать загрузку

```graphql
mutation InitiateUpload($input: InitiateUploadInput!) {
  initiateUpload(input: $input) {
    fileId
    uploadUrl
    storageKey
    status
  }
}
```

**Variables:**

```json
{
  "input": {
    "originalName": "my-photo.jpg",
    "mimeType": "image/jpeg",
    "size": 1048576
  }
}
```

**Поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `originalName` | `String!` | Имя файла с расширением |
| `mimeType` | `String!` | Только `image/jpeg` или `image/png` |
| `size` | `Int!` | Размер в байтах, макс 20 MB (20 × 1024 × 1024) |

**Ответ:**

```json
{
  "data": {
    "initiateUpload": {
      "fileId": "550e8400-e29b-41d4-a716-446655440000",
      "uploadUrl": "https://minio.example.com/bucket/uuid.jpg?X-Amz-Algorithm=...",
      "storageKey": "user-uuid/filename-uuid.jpg",
      "status": "PENDING"
    }
  }
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `fileId` | `ID!` | UUID файла, сохраните его |
| `uploadUrl` | `String!` | Presigned URL для PUT-загрузки |
| `storageKey` | `String!` | Ключ объекта в хранилище |
| `status` | `FileStatus!` | `PENDING` |

**Ошибки:**

- `400 Bad Request` — неверный mimeType (не JPEG/PNG) или размер > 20 MB
- `401 Unauthorized` — нет JWT-токена

### 2.2 Загрузить файл в MinIO/S3

```
PUT <uploadUrl>
Content-Type: image/jpeg
Body: <бинарные данные файла>
```

- Content-Type должен совпадать с `mimeType` из шага 2.1
- Тело запроса — сырые байты файла

**Успех:** `200 OK`
**Ошибка:** `403 Forbidden` — URL истёк (900 секунд = 15 минут)

### 2.3 Подтвердить загрузку

```graphql
mutation CompleteUpload($input: CompleteUploadInput!) {
  completeUpload(input: $input) {
    fileId
    status
  }
}
```

**Variables:**

```json
{
  "input": {
    "fileId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Ответ:**

```json
{
  "data": {
    "completeUpload": {
      "fileId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "READY"
    }
  }
}
```

**Ошибки:**

- `404 Not Found` — файл с таким fileId не существует
- `409 Conflict` — файл не найден в хранилище (upload не состоялся)
- Повторный вызов с тем же fileId вернёт `READY` (идемпотентно)

---

## 3. Шаг 2: Создание поста (posts-microservice)

После того как **все** файлы загружены и имеют статус `READY` — создаём пост.

### Мутация

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    ownerId
    description
    attachments {
      fileId
      sortOrder
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "fileIds": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "description": "Мой первый пост!"
  }
}
```

**Поля input:**

| Поле | Тип | Обязательно | Описание |
|------|-----|------------|----------|
| `fileIds` | `[ID!]!` | Да | Массив fileId загруженных и подтверждённых файлов. От 1 до 10 |
| `description` | `String` | Нет | Текст поста. Макс 500 символов |

**Ответ:**

```json
{
  "data": {
    "createPost": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "ownerId": "880e8400-e29b-41d4-a716-446655440003",
      "description": "Мой первый пост!",
      "attachments": [
        { "fileId": "550e8400-e29b-41d4-a716-446655440000", "sortOrder": 0 },
        { "fileId": "660e8400-e29b-41d4-a716-446655440001", "sortOrder": 1 }
      ],
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Что происходит на сервере:**

1. Posts service получает ваш JWT и извлекает `ownerId`
2. Posts service вызывает `files.ownedFilesByIds` и проверяет:
   - все fileId существуют
   - все принадлежат текущему пользователю (`ownerId`)
   - все имеют статус `READY`
3. Если проверка пройдена — создаётся запись Post + PostAttachment[] в одной транзакции
4. `sortOrder` для attachment = индекс в массиве `fileIds`

**Ошибки:**

- `400 Bad Request` — массив fileIds пуст или больше 10, description длиннее 500 символов
- `401 Unauthorized` — нет или невалидный JWT
- `422 Unprocessable Entity` — один из fileIds не существует / не принадлежит вам / не в статусе READY

---

## 4. Редактирование поста

Редактировать можно **только описание**. Файлы не меняются (изменить attachment'ы нельзя — только удалить и создать заново).

### Мутация

```graphql
mutation UpdatePostDescription($input: UpdatePostDescriptionInput!) {
  updatePostDescription(input: $input) {
    id
    ownerId
    description
    attachments {
      fileId
      sortOrder
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "postId": "770e8400-e29b-41d4-a716-446655440002",
    "description": "Обновлённое описание поста"
  }
}
```

**Поля input:**

| Поле | Тип | Обязательно | Описание |
|------|-----|------------|----------|
| `postId` | `ID!` | Да | UUID поста |
| `description` | `String` | Нет | Новый текст. Макс 500 символов. Если `null` — описание станет пустым |

**Ответ:** полный объект `PostModel` с обновлённым `description` и `updatedAt`

**Поведение:**

- Если пользователь не внёс изменений и нажал закрыть — модальное окно **не показываем** (логика на фронте)
- Если пользователь внёс изменения и закрыл форму — сначала показываем диалог:
  > _"Do you really want to finish editing? If you close the changes you have made will not be saved"_
  - **Yes** → не вызываем мутацию, закрываем форму
  - **No / крестик** → остаёмся на форме

**Ошибки:**

- `401 Unauthorized` — нет JWT
- `403 Forbidden` — postId не принадлежит текущему пользователю
- `404 Not Found` — пост не существует или мягко удалён
- `400 Bad Request` — description > 500 символов

---

## 5. Удаление поста

Удаление — **мягкое** (soft delete). Пост помечается `deletedAt` и не отображается в ленте, но физически запись остаётся в БД. Файлы **не удаляются** (очистка осиротевших файлов — позже).

### Мутация

```graphql
mutation DeletePost($input: DeletePostInput!) {
  deletePost(input: $input)
}
```

**Variables:**

```json
{
  "input": {
    "postId": "770e8400-e29b-41d4-a716-446655440002"
  }
}
```

**Поля input:**

| Поле | Тип | Описание |
|------|-----|----------|
| `postId` | `ID!` | UUID поста |

**Ответ:** `true` — если удаление успешно

**Поведение на фронте:**

- После шага 4 из UC-3 (появились "Edit Post" и "Delete Post") пользователь нажимает "Delete Post"
- Показываем диалог подтверждения:
  > _"Are you sure you want to delete this post?"_
  - **Yes** → вызываем мутацию, после успеха редирект на домашнюю страницу
  - **No / крестик** → ничего не делаем, остаёмся на странице поста

**Ошибки:**

- `401 Unauthorized` — нет JWT
- `403 Forbidden` — пост не принадлежит текущему пользователю
- `404 Not Found` — пост не существует (или уже удалён)
- Повторный вызов с тем же postId вернёт `true` (идемпотентно)

---

## 6. Просмотр своих постов (профиль)

Страница профиля пользователя. Доступна **всем** (в том числе неавторизованным). Пагинация — курсорная, от новых к старым.

### Query

```graphql
query ProfilePosts($input: ProfilePostsInput!) {
  profilePosts(input: $input) {
    edges {
      cursor
      node {
        id
        ownerId
        description
        attachments {
          fileId
          sortOrder
        }
        createdAt
        updatedAt
      }
    }
    pageInfo {
      startCursor
      endCursor
      hasNextPage
    }
  }
}
```

**Variables:**

```json
// Первая страница
{
  "input": {
    "userId": "880e8400-e29b-41d4-a716-446655440003",
    "first": 8
  }
}

// Следующая страница (cursor = createdAt последнего поста с первой страницы)
{
  "input": {
    "userId": "880e8400-e29b-41d4-a716-446655440003",
    "first": 8,
    "after": "2025-01-15T10:30:00.000Z"
  }
}
```

**Поля input:**

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `userId` | `ID!` | — | UUID пользователя, чьи посты смотрим |
| `first` | `Int` | `8` | Сколько постов вернуть (1–8) |
| `after` | `String` | `null` | Курсор — значение `createdAt` последнего поста с предыдущей страницы в ISO строке |

**Ответ:**

```json
{
  "data": {
    "profilePosts": {
      "edges": [
        {
          "cursor": "2025-01-15T10:30:00.000Z",
          "node": {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "ownerId": "880e8400-e29b-41d4-a716-446655440003",
            "description": "Мой первый пост!",
            "attachments": [
              { "fileId": "550e8400-e29b-41d4-a716-446655440000", "sortOrder": 0 }
            ],
            "createdAt": "2025-01-15T10:30:00.000Z",
            "updatedAt": "2025-01-15T10:30:00.000Z"
          }
        }
      ],
      "pageInfo": {
        "startCursor": "2025-01-15T10:30:00.000Z",
        "endCursor": "2025-01-15T09:00:00.000Z",
        "hasNextPage": true
      }
    }
  }
}
```

**Логика пагинации:**

- `after === null` — первая страница (самые новые)
- `after === <createdAt>` — посты, созданные **до** этой даты
- Если вернулось меньше, чем `first` — это последняя страница
- `hasNextPage: true` — есть ещё страницы (на сервере есть как минимум `first + 1` постов)

---

## 7. Лента на главной

Публичный endpoint, доступен без авторизации. Возвращает **4 последних поста** (без мягко удалённых).

### Query

```graphql
query Feed {
  feed {
    id
    ownerId
    description
    attachments {
      fileId
      sortOrder
    }
    createdAt
    updatedAt
  }
}
```

**Ответ:** массив `PostModel[]`, отсортированный от новых к старым, макс 4 элемента.

---

## 8. Типы данных (GraphQL schema)

### Posts Service

```graphql
# --- Input Types ---

input CreatePostInput {
  fileIds: [ID!]!        # От 1 до 10 fileId
  description: String     # Макс 500 символов
}

input UpdatePostDescriptionInput {
  postId: ID!             # UUID поста
  description: String      # Макс 500 символов
}

input DeletePostInput {
  postId: ID!              # UUID поста
}

input ProfilePostsInput {
  userId: ID!              # Чей профиль смотрим
  first: Int = 8           # 1–8 постов на странице
  after: String            # Курсор (createdAt в ISO)
}

# --- Object Types ---

type PostAttachment {
  fileId: ID!
  sortOrder: Int!
}

type Post {
  id: ID!
  ownerId: ID!
  description: String
  attachments: [PostAttachment!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type PostEdge {
  cursor: String!
  node: Post!
}

type PageInfo {
  startCursor: String
  endCursor: String
  hasNextPage: Boolean!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

# --- Query & Mutation ---

type Query {
  feed: [Post!]!
  post(id: ID!): Post
  profilePosts(input: ProfilePostsInput!): PostConnection!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  updatePostDescription(input: UpdatePostDescriptionInput!): Post!
  deletePost(input: DeletePostInput!): Boolean!
}
```

### Files Service (только нужное для posts)

```graphql
enum FileStatus {
  PENDING
  READY
  FAILED
}

input InitiateUploadInput {
  originalName: String!
  mimeType: String!
  size: Int!
}

type InitiateUploadPayload {
  fileId: ID!
  uploadUrl: String!
  storageKey: String!
  status: FileStatus!
}

input CompleteUploadInput {
  fileId: ID!
}

type CompleteUploadPayload {
  fileId: ID!
  status: FileStatus!
}

type Mutation {
  initiateUpload(input: InitiateUploadInput!): InitiateUploadPayload!
  completeUpload(input: CompleteUploadInput!): CompleteUploadPayload!
}
```

---

## 9. Auth

| Query/Mutation | Требует JWT | Примечание |
|---------------|------------|------------|
| `initiateUpload` | ✅ Да | ownerId извлекается из токена |
| `completeUpload` | ✅ Да | Только владелец может подтвердить |
| `createPost` | ✅ Да | ownerId из токена, fileIds сверяются с owner |
| `updatePostDescription` | ✅ Да | Только владелец поста |
| `deletePost` | ✅ Да | Только владелец поста |
| `feed` | ❌ Нет | Публичный |
| `post(id)` | ❌ Нет | Публичный |
| `profilePosts` | ❌ Нет | Публичный |

**Как передавать токен:**

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Или в cookie (gateway пробрасывает автоматически).

---

## 10. Ошибки

### HTTP status codes (через gateway)

| Код | Когда |
|-----|-------|
| `200 OK` | Успех |
| `400 Bad Request` | Невалидный input (mimeType, размер, длина description) |
| `401 Unauthorized` | Нет JWT или токен истёк |
| `403 Forbidden` | Попытка изменить/удалить чужой пост |
| `404 Not Found` | Пост или файл не найден |
| `422 Unprocessable Entity` | fileId не READY / не принадлежит пользователю |
| `429 Too Many Requests` | Лимит запросов |

### GraphQL ошибки

Все ошибки приходят в стандартном формате:

```json
{
  "errors": [
    {
      "message": "Post not found",
      "extensions": {
        "code": "NOT_FOUND",
        "postId": "770e8400-e29b-..."
      }
    }
  ]
}
```

### Валидация на фронте (дублировать)

| Правило | Где проверяется |
|---------|----------------|
| Формат фото: только JPEG/PNG | Фронт + сервер |
| Размер фото: макс 20 MB | Фронт + сервер |
| Количество фото: 1–10 | Фронт + сервер |
| Длина описания: макс 500 символов | Фронт + сервер |
| Presigned URL истекает через 15 минут | Фронт должен успеть загрузить |

---

## Приложение: Сценарии (UC) в терминах API

| Сценарий | API вызовы |
|----------|-----------|
| **UC-1. Создание поста** | `initiateUpload` → `PUT uploadUrl` → `completeUpload` (×N файлов) → `createPost` |
| **UC-2. Редактирование поста** | `updatePostDescription(postId, description)` |
| **UC-3. Удаление поста** | `deletePost(postId)` |
| **UC-4. Свои посты (профиль)** | `profilePosts(userId, first: 8)` + пагинация |
| **Главная страница** | `feed` (публичный) |
