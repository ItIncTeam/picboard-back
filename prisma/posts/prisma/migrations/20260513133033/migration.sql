-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "coverImageFileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX "Post_coverImageFileId_idx" ON "Post"("coverImageFileId");
