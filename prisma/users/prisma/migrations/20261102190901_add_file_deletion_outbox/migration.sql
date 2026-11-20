-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "FileDeletionOutbox" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "fileIds" UUID[],
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FileDeletionOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileDeletionOutbox_status_nextAttemptAt_idx" ON "FileDeletionOutbox"("status", "nextAttemptAt");
