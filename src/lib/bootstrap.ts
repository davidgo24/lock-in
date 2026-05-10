import { prisma } from "@/lib/prisma";

/** Ensures settings and the Misc project exist for this user (safe to call often). */
export async function ensureDefaultData(userId: string) {
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, weeklyGoalHours: 7 },
    update: {},
  });

  const misc = await prisma.project.findFirst({
    where: { userId, isMisc: true },
  });
  if (!misc) {
    await prisma.project.create({
      data: { userId, name: "General", isMisc: true },
    });
  }
}
