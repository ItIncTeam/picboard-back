/*
  Warnings:

  - You are about to drop the `FileAsset` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('POST_IMAGE', 'BILL');

-- CreateEnum
CREATE TYPE "Mime" AS ENUM ('JPEG', 'PNG');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'READY', 'FAILED', 'DELETED');

-- DropTable
DROP TABLE "FileAsset";

-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "purpose" "Purpose" NOT NULL,
    "mimeType" "Mime" NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "failedReason" TEXT,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_storageKey_key" ON "file"("storageKey");

-- CreateIndex
CREATE INDEX "file_ownerId_idx" ON "file"("ownerId");

-- CreateIndex
CREATE INDEX "file_status_idx" ON "file"("status");

-- CreateIndex
CREATE INDEX "file_ownerId_status_idx" ON "file"("ownerId", "status");
