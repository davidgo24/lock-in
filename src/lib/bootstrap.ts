import { prisma } from "@/lib/prisma";

/** Ensures singleton settings and the Misc project exist (safe to call often). */
export async function ensureDefaultData() {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", weeklyGoalHours: 7 },
    update: {},
  });

  const misc = await prisma.project.findFirst({ where: { isMisc: true } });
  if (!misc) {
    await prisma.project.create({
      data: { name: "Misc. tasks", isMisc: true },
    });
  }
}
