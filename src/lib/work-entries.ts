import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFriendUserIds, publicLabel } from "@/lib/friends";

const workEntrySelect = {
  id: true,
  summary: true,
  durationSec: true,
  createdAt: true,
  workDate: true,
  project: { select: { name: true, isMisc: true } },
} as const satisfies Prisma.ActivitySessionSelect;

const friendFeedSelect = {
  id: true,
  summary: true,
  durationSec: true,
  createdAt: true,
  workDate: true,
  project: {
    select: {
      name: true,
      isMisc: true,
      user: { select: { id: true, displayName: true, handle: true } },
    },
  },
} as const satisfies Prisma.ActivitySessionSelect;

export type RecentWorkEntryRow = Prisma.ActivitySessionGetPayload<{
  select: typeof workEntrySelect;
}>;

export type FriendFeedEntryRow = Prisma.ActivitySessionGetPayload<{
  select: typeof friendFeedSelect;
}>;

export async function getRecentWorkEntries(
  userId: string,
): Promise<RecentWorkEntryRow[]> {
  return prisma.activitySession.findMany({
    where: { project: { is: { userId } } },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: workEntrySelect,
  });
}

export async function getFriendsWorkEntries(
  userId: string,
): Promise<FriendFeedEntryRow[]> {
  const friendIds = await getFriendUserIds(userId);
  if (friendIds.length === 0) return [];
  return prisma.activitySession.findMany({
    where: { project: { is: { userId: { in: friendIds } } } },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: friendFeedSelect,
  });
}

export function mapFriendFeedEntryToClient(e: FriendFeedEntryRow) {
  const authorLabel = publicLabel(e.project.user);
  return {
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: { name: e.project.name, isMisc: e.project.isMisc },
    authorLabel,
  };
}
