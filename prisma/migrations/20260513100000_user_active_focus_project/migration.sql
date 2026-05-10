-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeFocusProjectId" TEXT;

-- CreateIndex
CREATE INDEX "User_activeFocusProjectId_idx" ON "User"("activeFocusProjectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeFocusProjectId_fkey" FOREIGN KEY ("activeFocusProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
