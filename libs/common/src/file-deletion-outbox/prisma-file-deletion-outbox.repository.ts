import { Inject, Injectable } from '@nestjs/common';
import {
  FileDeletionOutboxRepository,
  OutboxTask,
} from './file-deletion-outbox.repository';

type OutboxStatus = 'PENDING' | 'DONE' | 'FAILED';

// The part of a generated Prisma client this repository uses. Any service whose
// schema has a FileDeletionOutbox model with these columns (and an OutboxStatus
// enum) satisfies it, so posts and users share one implementation even though
// each has its own generated client.
export interface FileDeletionOutboxPrismaClient {
  fileDeletionOutbox: {
    findMany(args: {
      where: { status: OutboxStatus; nextAttemptAt: { lte: Date } };
      orderBy: { nextAttemptAt: 'asc' };
      take: number;
    }): PromiseLike<OutboxTask[]>;
    update(args: {
      where: { id: string };
      data: {
        status?: OutboxStatus;
        attempts?: { increment: number };
        lastError?: string | null;
        nextAttemptAt?: Date;
        processedAt?: Date;
      };
    }): PromiseLike<unknown>;
    deleteMany(args: {
      where: { status: OutboxStatus; processedAt: { lt: Date } };
    }): PromiseLike<{ count: number }>;
  };
}

export const FILE_DELETION_OUTBOX_PRISMA = Symbol(
  'FILE_DELETION_OUTBOX_PRISMA',
);

@Injectable()
export class PrismaFileDeletionOutboxRepository implements FileDeletionOutboxRepository {
  constructor(
    @Inject(FILE_DELETION_OUTBOX_PRISMA)
    private readonly prisma: FileDeletionOutboxPrismaClient,
  ) {}

  async findPendingBatch(now: Date, limit: number): Promise<OutboxTask[]> {
    const rows = await this.prisma.fileDeletionOutbox.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      fileIds: r.fileIds,
      attempts: r.attempts,
    }));
  }

  async markDone(id: string): Promise<void> {
    await this.prisma.fileDeletionOutbox.update({
      where: { id },
      data: { status: 'DONE', processedAt: new Date(), lastError: null },
    });
  }

  async reschedule(
    id: string,
    error: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.prisma.fileDeletionOutbox.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: error,
        nextAttemptAt,
      },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.fileDeletionOutbox.update({
      where: { id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: error,
        processedAt: new Date(),
      },
    });
  }

  async deleteDoneOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.fileDeletionOutbox.deleteMany({
      where: { status: 'DONE', processedAt: { lt: cutoff } },
    });
    return count;
  }
}
