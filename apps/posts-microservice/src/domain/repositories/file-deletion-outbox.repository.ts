/** Задача из outbox, готовая к доставке в files-сервис */
export type OutboxTask = {
  id: string;
  postId: string;
  ownerId: string;
  fileIds: string[];
  attempts: number;
};

export abstract class FileDeletionOutboxRepository {
  /** Задачи, готовые к обработке: status=PENDING и nextAttemptAt <= now */
  abstract findPendingBatch(now: Date, limit: number): Promise<OutboxTask[]>;

  /** Доставка успешна — помечаем DONE */
  abstract markDone(id: string): Promise<void>;

  /** Ошибка доставки — attempts++, фиксируем ошибку, откладываем до nextAttemptAt */
  abstract reschedule(
    id: string,
    error: string,
    nextAttemptAt: Date,
  ): Promise<void>;

  /** Лимит попыток исчерпан — окончательно FAILED (остаётся для разбора) */
  abstract markFailed(id: string, error: string): Promise<void>;

  /**
   * Удаляет доставленные (DONE) задачи старше cutoff — чтобы таблица не росла.
   * Возвращает число удалённых записей.
   */
  abstract deleteDoneOlderThan(cutoff: Date): Promise<number>;
}
