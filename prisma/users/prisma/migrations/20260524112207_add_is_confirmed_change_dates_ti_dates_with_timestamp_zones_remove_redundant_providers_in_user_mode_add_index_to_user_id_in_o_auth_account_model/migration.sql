/*
  Warnings:

  - You are about to drop the column `userName` on the `OAuthAccount` table. All the data in the column will be lost.
  - You are about to drop the column `providers` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OAuthAccount" DROP COLUMN "userName",
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "providers",
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "confirmationCodeExpDate" SET DATA TYPE TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
