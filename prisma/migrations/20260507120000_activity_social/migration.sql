-- CreateEnum
CREATE TYPE "ActivityNotificationType" AS ENUM ('CLAP', 'COMMENT');

-- CreateTable
CREATE TABLE "ActivityClap" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityClap_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "ActivityComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ActivityNotificationType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityClap_userId_idx" ON "ActivityClap"("userId");

-- CreateIndex
CREATE INDEX "ActivityComment_sessionId_idx" ON "ActivityComment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityComment_sessionId_userId_key" ON "ActivityComment"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ActivityNotification_recipientId_readAt_idx" ON "ActivityNotification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "ActivityNotification_recipientId_createdAt_idx" ON "ActivityNotification"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityClap" ADD CONSTRAINT "ActivityClap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityClap" ADD CONSTRAINT "ActivityClap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityComment" ADD CONSTRAINT "ActivityComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityComment" ADD CONSTRAINT "ActivityComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityNotification" ADD CONSTRAINT "ActivityNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityNotification" ADD CONSTRAINT "ActivityNotification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityNotification" ADD CONSTRAINT "ActivityNotification_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
