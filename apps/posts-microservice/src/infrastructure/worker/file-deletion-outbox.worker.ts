import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FileDeletionOutboxRepository } from '../../domain/repositories/file-deletion-outbox.repository';
import { FilesServiceClient } from '../client/files-service.client';

/** Период опроса outbox-таблицы */
const PROCESS_INTERVAL_MS = 15_000;
/** Сколько задач брать за один проход */
const BATCH_SIZE = 20;
/** Максимум попыток доставки до окончательного FAILED */
export const MAX_ATTEMPTS = 5;
/** Базовая задержка экспоненциального backoff */
const BASE_BACKOFF_MS = 30_000;
/** Сколько дней хранить доставленные (DONE) задачи до удаления */
export const RETENTION_DAYS = 7;
/** Раз во сколько проходов запускать очистку (240 × 15с ≈ 1 час) */
export const CLEANUP_EVERY_TICKS = 240;

@Injectable()
export class FileDeletionOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileDeletionOutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private ticksSinceCleanup = 0;

  constructor(
    private readonly outbox: FileDeletionOutboxRepository,
    private readonly filesClient: FilesServiceClient,
  ) {}

  onModuleInit(): void {
    // в тестах воркер не нужен (не долбим TCP и не трогаем БД в фоне)
    if (process.env.NODE_ENV === 'testing') {
      this.logger.log('FileDeletionOutboxWorker disabled (testing)');
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, PROCESS_INTERVAL_MS);
    this.logger.log(
      `FileDeletionOutboxWorker started (interval=${PROCESS_INTERVAL_MS}ms, batch=${BATCH_SIZE})`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Один проход: забрать пачку PENDING и доставить. Публичный — для тестов. */
  async tick(): Promise<void> {
    // не накладываем проходы друг на друга
    if (this.running) return;
    this.running = true;
    try {
      await this.processBatch();
      if (++this.ticksSinceCleanup >= CLEANUP_EVERY_TICKS) {
        this.ticksSinceCleanup = 0;
        await this.cleanup();
      }
    } catch (error) {
      this.logger.error(
        'Outbox processing pass failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async processBatch(): Promise<void> {
    const now = new Date();
    const batch = await this.outbox.findPendingBatch(now, BATCH_SIZE);
    if (batch.length === 0) return;

    for (const task of batch) {
      await this.deliver(task);
    }
  }

  /** Удаляет доставленные задачи старше RETENTION_DAYS, чтобы таблица не росла */
  private async cleanup(): Promise<void> {
    try {
      const cutoff = new Date(
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      const removed = await this.outbox.deleteDoneOlderThan(cutoff);
      if (removed > 0) {
        this.logger.log(`Outbox cleanup: removed ${removed} DONE task(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Outbox cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async deliver(task: {
    id: string;
    ownerId: string;
    fileIds: string[];
    attempts: number;
  }): Promise<void> {
    try {
      await this.filesClient.markFilesDeleted({
        ownerId: task.ownerId,
        fileIds: task.fileIds,
      });
      await this.outbox.markDone(task.id);
      this.logger.log(`Delivered file deletion for outbox task ${task.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextAttempt = task.attempts + 1;

      if (nextAttempt >= MAX_ATTEMPTS) {
        await this.outbox.markFailed(task.id, message);
        this.logger.error(
          `Outbox task ${task.id} failed after ${nextAttempt} attempts: ${message}`,
        );
        return;
      }

      const delay = BASE_BACKOFF_MS * 2 ** task.attempts;
      await this.outbox.reschedule(
        task.id,
        message,
        new Date(Date.now() + delay),
      );
      this.logger.warn(
        `Outbox task ${task.id} retry #${nextAttempt} scheduled in ${delay}ms: ${message}`,
      );
    }
  }
}
