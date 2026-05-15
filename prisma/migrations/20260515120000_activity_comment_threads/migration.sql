-- Allow multiple comments per user per session (threaded conversation / replies).
DROP INDEX "ActivityComment_sessionId_userId_key";
CREATE INDEX "ActivityComment_sessionId_userId_idx" ON "ActivityComment"("sessionId", "userId");
