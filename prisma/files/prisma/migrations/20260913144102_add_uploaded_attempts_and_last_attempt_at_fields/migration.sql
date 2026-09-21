-- AlterTable
ALTER TABLE "file" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "uploadAttempts" INTEGER NOT NULL DEFAULT 1;
