import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../prisma/apps/posts/src/generated/prisma/posts-client';
import { PrismaFileDeletionOutboxRepository } from '@app/common/file-deletion-outbox/prisma-file-deletion-outbox.repository';

const TEST_OWNER_ID = 'outbox-integration-test-owner';
const TEST_POST_ID = 'outbox-integration-test-post';
const LEASE_MS = 60_000;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for outbox integration tests');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const repository = new PrismaFileDeletionOutboxRepository(prisma);

describe('PrismaFileDeletionOutboxRepository (integration)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.fileDeletionOutbox.deleteMany({
      where: { ownerId: TEST_OWNER_ID },
    });
  });

  afterAll(async () => {
    await prisma.fileDeletionOutbox.deleteMany({
      where: { ownerId: TEST_OWNER_ID },
    });
    await prisma.$disconnect();
  });

  const createTask = (
    overrides: { attempts?: number; nextAttemptAt?: Date } = {},
  ) =>
    prisma.fileDeletionOutbox.create({
      data: {
        postId: TEST_POST_ID,
        ownerId: TEST_OWNER_ID,
        fileIds: ['file-1'],
        attempts: overrides.attempts ?? 0,
        nextAttemptAt: overrides.nextAttemptAt ?? new Date(0),
      },
    });

  const readTask = (id: string) =>
    prisma.fileDeletionOutbox.findUniqueOrThrow({ where: { id } });

  it('claims a due task exactly once under concurrent claims', async () => {
    const task = await createTask();
    const now = new Date();

    const [left, right] = await Promise.all([
      repository.claim(task.id, now, LEASE_MS),
      repository.claim(task.id, now, LEASE_MS),
    ]);

    const winners = [left, right].filter((value) => value !== null);
    expect(winners).toHaveLength(1);

    const stored = await readTask(task.id);
    expect(stored.status).toBe('PENDING');
    expect(stored.attempts).toBe(0);
    expect(stored.nextAttemptAt.getTime()).toBe(now.getTime() + LEASE_MS);
  });

  it('returns fresh attempts and file data from claim', async () => {
    const task = await createTask({ attempts: 4 });
    const claimed = await repository.claim(task.id, new Date(), LEASE_MS);

    expect(claimed).not.toBeNull();
    expect(claimed).toMatchObject({
      id: task.id,
      ownerId: TEST_OWNER_ID,
      fileIds: ['file-1'],
      attempts: 4,
    });
  });

  it('allows a second claim after the lease expires', async () => {
    const task = await createTask();
    const first = await repository.claim(task.id, new Date(), 50);
    expect(first).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const second = await repository.claim(task.id, new Date(), LEASE_MS);
    expect(second).not.toBeNull();
  });

  it('rejects status updates from a stale lease after a new claim', async () => {
    const task = await createTask();
    const first = await repository.claim(task.id, new Date(), 50);
    expect(first).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const second = await repository.claim(task.id, new Date(), LEASE_MS);
    expect(second).not.toBeNull();

    await expect(repository.markDone(task.id, first!.leaseUntil)).resolves.toBe(
      false,
    );
    await expect(
      repository.markDone(task.id, second!.leaseUntil),
    ).resolves.toBe(true);

    const stored = await readTask(task.id);
    expect(stored.status).toBe('DONE');
  });

  it('increments attempts once and rejects a duplicate reschedule for the same lease', async () => {
    const task = await createTask({ attempts: 0 });
    const claimed = await repository.claim(task.id, new Date(), LEASE_MS);
    expect(claimed).not.toBeNull();

    const nextAttemptAt = new Date(Date.now() + 60_000);

    await expect(
      repository.reschedule(
        task.id,
        'first failure',
        nextAttemptAt,
        claimed!.leaseUntil,
      ),
    ).resolves.toBe(true);
    await expect(
      repository.reschedule(
        task.id,
        'duplicate failure',
        nextAttemptAt,
        claimed!.leaseUntil,
      ),
    ).resolves.toBe(false);

    const stored = await readTask(task.id);
    expect(stored.status).toBe('PENDING');
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toBe('first failure');
    expect(stored.nextAttemptAt.getTime()).toBe(nextAttemptAt.getTime());
  });
});
