import { Injectable } from '@nestjs/common';
import { PostsPrismaService } from '../../prisma/posts-prisma.service';
import {
  FileDeletionOutboxRepository,
  OutboxTask,
} from '../../domain/repositories/file-deletion-outbox.repository';

@Injectable()
export class PrismaFileDeletionOutboxRepository
  implements FileDeletionOutboxRepository
{
  constructor(private readonly prisma: PostsPrismaService) {}

  async findPendingBatch(now: Date, limit: number): Promise<OutboxTask[]> {
    const rows = await this.prisma.fileDeletionOutbox.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      postId: r.postId,
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
