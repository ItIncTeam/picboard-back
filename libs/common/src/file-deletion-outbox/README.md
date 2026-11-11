# File deletion outbox

Общий transactional outbox для удаления файлов в files-microservice. Используется posts и будущими сервисами (users и т.д.).

## Контракт Prisma-модели

Сервис, который использует общий воркер, должен добавить в свою схему модель с именем FileDeletionOutbox (delegate prisma.fileDeletionOutbox) и enum OutboxStatus.

Таблица полей:

| Поле          | Тип                            | Назначение                                              |
| ------------- | ------------------------------ | ------------------------------------------------------- |
| id            | String @id @default(uuid())    | id задачи                                               |
| ownerId       | String                         | владелец файлов (TEXT или UUID — на усмотрении сервиса) |
| fileIds       | String[]                       | файлы к удалению (TEXT[] или UUID[])                    |
| status        | OutboxStatus @default(PENDING) | PENDING / DONE / FAILED                                 |
| attempts      | Int @default(0)                | число неудачных попыток                                 |
| lastError     | String?                        | последняя ошибка                                        |
| nextAttemptAt | DateTime @default(now())       | когда задачу можно брать; одновременно lease            |
| processedAt   | DateTime?                      | когда задача завершена (DONE/FAILED)                    |

Дополнительно: createdAt/updatedAt по желанию, но если есть updatedAt, он должен быть `@updatedAt` — иначе `updateMany` не сможет его обновить. Обязательный индекс: `@@index([status, nextAttemptAt])`.

Код enum:

```prisma
enum OutboxStatus {
  PENDING
  DONE
  FAILED
}
```

## Подключение

Один раз в модуле сервиса:

```ts
...provideFileDeletionOutbox({
  prisma: UsersPrismaService,
  filesClient: FilesServiceClient,
}),
```

Условия:

- prisma — сервисный PrismaClient, у которого есть модель FileDeletionOutbox;
- filesClient — клиент, реализующий `FileDeletionSender.markFilesDeleted({ ownerId, fileIds })`;
- провайдер подключается ровно один раз на сервис, иначе поднимутся лишние воркеры.

## Постановка задачи

Строка создаётся в той же транзакции, что и доменное изменение:

```ts
await prisma.$transaction(async (tx) => {
  await tx.user.update({ ... });
  await tx.fileDeletionOutbox.create({
    data: { ownerId, fileIds: [previousFileId] },
  });
});
```

Без транзакции возможна ситуация «файл заменён, а задача не создана».

## Что делает воркер

- опрашивает PENDING раз в 15 секунд, батч 20;
- атомарно клеймит задачу через nextAttemptAt (lease 60 секунд);
- делает markDone / reschedule / markFailed только если lease всё ещё принадлежит этому воркеру;
- повторяет 5xx/сеть/таймаут и не повторяет 4xx;
- раз в час удаляет старые DONE.

## Чек-лист нового сервиса

1. Добавить модель/enum/индекс и миграцию в свою Prisma-схему.
2. Реализовать files-клиент с markFilesDeleted.
3. Подключить provideFileDeletionOutbox ровно один раз.
4. Создавать outbox-строку в транзакции с доменным изменением.
5. Добавить integration-тест на своей БД: два параллельных claim, истечение lease, повторный reschedule.
6. Накатить миграцию до старта воркера.

## Ограничения

- FAILED-строки не чистятся автоматически; нужен алерт/retention.
- 4xx сейчас считается permanent целиком (408/429 — известное ограничение).
- LEASE_MS = 60 c; timeout files-клиента должен быть меньше lease.
- У каждого сервиса своя БД и свой outbox; кросс-сервисной транзакции нет.
