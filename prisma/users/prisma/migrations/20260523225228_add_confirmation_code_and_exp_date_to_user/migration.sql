-- AlterTable
ALTER TABLE "User" ADD COLUMN     "confirmationCode" TEXT,
ADD COLUMN     "confirmationCodeExpDate" TIMESTAMP(3);
