-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Owner account for existing data (password: `password` — change immediately in production)
INSERT INTO "User" ("id", "email", "passwordHash", "displayName", "createdAt")
VALUES (
  'legacy_owner_user_id',
  'owner@local.dev',
  '$2b$10$AyULD2XEuTeJhPjPlXy7E.f0ZpbMIT8TuEuk5V6xyzsfBLO6Qzu7e',
  'Owner',
  CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "userId" TEXT;

UPDATE "Project" SET "userId" = 'legacy_owner_user_id' WHERE "userId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;

-- Migrate AppSettings singleton → per-user
CREATE TABLE "AppSettings_new" (
    "userId" TEXT NOT NULL,
    "weeklyGoalHours" DOUBLE PRECISION NOT NULL DEFAULT 7,

    CONSTRAINT "AppSettings_new_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "AppSettings_new" ("userId", "weeklyGoalHours")
VALUES (
  'legacy_owner_user_id',
  COALESCE((SELECT "weeklyGoalHours" FROM "AppSettings" WHERE "id" = 'default' LIMIT 1), 7)
);

DROP TABLE "AppSettings";

ALTER TABLE "AppSettings_new" RENAME TO "AppSettings";

ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old Project index and add user-scoped indexes
DROP INDEX "Project_isMisc_idx";

CREATE INDEX "Project_isMisc_idx" ON "Project"("isMisc");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_userId_isMisc_idx" ON "Project"("userId", "isMisc");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
