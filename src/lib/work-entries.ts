import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const workEntrySelect = {
  id: true,
  summary: true,
  durationSec: true,
  createdAt: true,
  workDate: true,
  project: { select: { name: true, isMisc: true } },
} as const satisfies Prisma.ActivitySessionSelect;

export type RecentWorkEntryRow = Prisma.ActivitySessionGetPayload<{
  select: typeof workEntrySelect;
}>;

export async function getRecentWorkEntries(
  userId: string,
): Promise<RecentWorkEntryRow[]> {
  return prisma.activitySession.findMany({
    where: { project: { userId } },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: workEntrySelect,
  });
}
