-- AlterTable
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Project_userId_archivedAt_idx" ON "Project"("userId", "archivedAt");
