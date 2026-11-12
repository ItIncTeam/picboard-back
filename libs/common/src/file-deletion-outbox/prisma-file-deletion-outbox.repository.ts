import { Inject, Injectable } from '@nestjs/common';
import {
  FileDeletionOutboxRepository,
  OutboxTask,
  ClaimedOutboxTask,
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
    updateMany(args: {
      where: {
        id: string;
        status: OutboxStatus;
        nextAttemptAt: Date | { lte: Date };
      };
      data: {
        status?: OutboxStatus;
        attempts?: { increment: number };
        lastError?: string | null;
        nextAttemptAt?: Date;
        processedAt?: Date;
      };
    }): PromiseLike<{ count: number }>;
    findFirst(args: {
      where: { id: string; status: OutboxStatus; nextAttemptAt: Date };
    }): PromiseLike<OutboxTask | null>;
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

  async claim(
    id: string,
    now: Date,
    leaseMs: number,
  ): Promise<ClaimedOutboxTask | null> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const { count } = await this.prisma.fileDeletionOutbox.updateMany({
      where: { id, status: 'PENDING', nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: leaseUntil },
    });
    if (count !== 1) return null;
    const row = await this.prisma.fileDeletionOutbox.findFirst({
      where: { id, status: 'PENDING', nextAttemptAt: leaseUntil },
    });
    if (row === null) return null;
    return {
      id: row.id,
      ownerId: row.ownerId,
      fileIds: row.fileIds,
      attempts: row.attempts,
      leaseUntil,
    };
  }

  async markDone(id: string, leaseUntil: Date): Promise<boolean> {
    const { count } = await this.prisma.fileDeletionOutbox.updateMany({
      where: { id, status: 'PENDING', nextAttemptAt: leaseUntil },
      data: { status: 'DONE', processedAt: new Date(), lastError: null },
    });
    return count === 1;
  }

  async reschedule(
    id: string,
    error: string,
    nextAttemptAt: Date,
    leaseUntil: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.fileDeletionOutbox.updateMany({
      where: { id, status: 'PENDING', nextAttemptAt: leaseUntil },
      data: {
        attempts: { increment: 1 },
        lastError: error,
        nextAttemptAt,
      },
    });
    return count === 1;
  }

  async markFailed(
    id: string,
    error: string,
    leaseUntil: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.fileDeletionOutbox.updateMany({
      where: { id, status: 'PENDING', nextAttemptAt: leaseUntil },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: error,
        processedAt: new Date(),
      },
    });
    return count === 1;
  }

  async deleteDoneOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.fileDeletionOutbox.deleteMany({
      where: { status: 'DONE', processedAt: { lt: cutoff } },
    });
    return count;
  }
}
