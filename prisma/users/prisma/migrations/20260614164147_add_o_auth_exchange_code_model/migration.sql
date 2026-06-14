/*
  Warnings:

  - Added the required column `updatedAt` to the `OAuthAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OAuthAccount" ADD COLUMN     "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL;

-- CreateTable
CREATE TABLE "oauth_exchange_code" (
    "id" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_exchange_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_exchange_code_codeHash_key" ON "oauth_exchange_code"("codeHash");

-- CreateIndex
CREATE INDEX "oauth_exchange_code_userId_expiresAt_idx" ON "oauth_exchange_code"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "oauth_exchange_code" ADD CONSTRAINT "oauth_exchange_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
