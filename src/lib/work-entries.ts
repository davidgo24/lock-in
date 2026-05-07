import { prisma } from "@/lib/prisma";

export async function getRecentWorkEntries() {
  return prisma.activitySession.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      summary: true,
      durationSec: true,
      createdAt: true,
      workDate: true,
      project: { select: { name: true, isMisc: true } },
    },
  });
}
