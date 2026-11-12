/** Задача из outbox, готовая к доставке в files-сервис */
export type OutboxTask = {
  id: string;
  ownerId: string;
  fileIds: string[];
  attempts: number;
};

export type ClaimedOutboxTask = OutboxTask & { leaseUntil: Date };

export abstract class FileDeletionOutboxRepository {
  /** Задачи, готовые к обработке: status=PENDING и nextAttemptAt <= now */
  abstract findPendingBatch(now: Date, limit: number): Promise<OutboxTask[]>;

  /** Атомарно резервирует задачу через leaseUntil */
  abstract claim(
    id: string,
    now: Date,
    leaseMs: number,
  ): Promise<ClaimedOutboxTask | null>;

  /** Доставка успешна — помечаем DONE */
  abstract markDone(id: string, leaseUntil: Date): Promise<boolean>;

  /** Ошибка доставки — attempts++, фиксируем ошибку, откладываем до nextAttemptAt */
  abstract reschedule(
    id: string,
    error: string,
    nextAttemptAt: Date,
    leaseUntil: Date,
  ): Promise<boolean>;

  /** Лимит попыток исчерпан — окончательно FAILED (остаётся для разбора) */
  abstract markFailed(
    id: string,
    error: string,
    leaseUntil: Date,
  ): Promise<boolean>;

  /**
   * Удаляет доставленные (DONE) задачи старше cutoff — чтобы таблица не росла.
   * Возвращает число удалённых записей.
   */
  abstract deleteDoneOlderThan(cutoff: Date): Promise<number>;
}
