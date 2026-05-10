import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFriendUserIds, publicLabel } from "@/lib/friends";
import type { ActivitySocialPayload } from "@/lib/activity-social";
import { getSocialBySessionIds } from "@/lib/activity-social";

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

export function mapFriendFeedEntryToClient(
  e: FriendFeedEntryRow,
  social?: ActivitySocialPayload | null,
) {
  const authorLabel = publicLabel(e.project.user);
  const s: ActivitySocialPayload = social ?? {
    clapCount: 0,
    clappedByMe: false,
    comments: [],
    myComment: null,
  };
  return {
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: { name: e.project.name, isMisc: e.project.isMisc },
    authorLabel,
    social: s,
  };
}

export function mapRecentEntryToClient(
  e: RecentWorkEntryRow,
  social?: ActivitySocialPayload | null,
) {
  const s: ActivitySocialPayload = social ?? {
    clapCount: 0,
    clappedByMe: false,
    comments: [],
    myComment: null,
  };
  return {
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: e.project,
    social: s,
  };
}

export async function getFriendFeedForClient(viewerId: string) {
  const rows = await getFriendsWorkEntries(viewerId);
  const ids = rows.map((r) => r.id);
  const socialMap = await getSocialBySessionIds(ids, viewerId);
  return rows.map((r) =>
    mapFriendFeedEntryToClient(r, socialMap.get(r.id) ?? null),
  );
}

export async function getRecentEntriesForClient(viewerId: string) {
  const rows = await getRecentWorkEntries(viewerId);
  const ids = rows.map((r) => r.id);
  const socialMap = await getSocialBySessionIds(ids, viewerId);
  return rows.map((r) =>
    mapRecentEntryToClient(r, socialMap.get(r.id) ?? null),
  );
}
