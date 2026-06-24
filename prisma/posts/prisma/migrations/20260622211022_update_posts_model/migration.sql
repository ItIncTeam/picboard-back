/*
  Warnings:

  - The primary key for the `Post` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `authorId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `coverImageFileId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Post` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Post_authorId_idx";

-- DropIndex
DROP INDEX "Post_coverImageFileId_idx";

-- AlterTable
ALTER TABLE "Post" DROP CONSTRAINT "Post_pkey",
DROP COLUMN "authorId",
DROP COLUMN "coverImageFileId",
DROP COLUMN "text",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "ownerId" TEXT NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Post_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "PostAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostAttachment_fileId_idx" ON "PostAttachment"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "PostAttachment_postId_fileId_key" ON "PostAttachment"("postId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "PostAttachment_postId_sortOrder_key" ON "PostAttachment"("postId", "sortOrder");

-- CreateIndex
CREATE INDEX "Post_ownerId_createdAt_idx" ON "Post"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- AddForeignKey
ALTER TABLE "PostAttachment" ADD CONSTRAINT "PostAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
