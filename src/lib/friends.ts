import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const userPublicSelect = {
  id: true,
  displayName: true,
  handle: true,
  avatarBytes: true,
} as const satisfies Prisma.UserSelect;

const friendPublicSelect = {
  ...userPublicSelect,
  activeFocusEndsAt: true,
  activeFocusProject: { select: { name: true, isMisc: true } },
} as const satisfies Prisma.UserSelect;

export type PublicUserMini = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

export function publicLabel(u: PublicUserMini): string {
  const d = u.displayName?.trim();
  if (d) return d;
  if (u.handle) return `@${u.handle}`;
  return "Member";
}

/** Lexicographic order so `userAId` < `userBId` in `Friendship`. */
export function friendshipKeyPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getFriendUserIds(userId: string): Promise<string[]> {
  const asA = await prisma.friendship.findMany({
    where: { userAId: userId },
    select: { userBId: true },
  });
  const asB = await prisma.friendship.findMany({
    where: { userBId: userId },
    select: { userAId: true },
  });
  return [...asA.map((r) => r.userBId), ...asB.map((r) => r.userAId)];
}

export type FriendsStatePayload = {
  myHandle: string | null;
  friends: {
    userId: string;
    handle: string | null;
    label: string;
    hasAvatar: boolean;
    /** ISO end time if friend is in an active focus block (in the future); otherwise null. */
    activeFocusEndsAt: string | null;
    /** Their current focus area label while the timer is running; null if unknown. */
    activeFocusProjectName: string | null;
  }[];
  /** Friends-of-friends with a handle — same invite flow as typing their @handle. */
  suggestions: {
    userId: string;
    handle: string;
    label: string;
    hasAvatar: boolean;
    /** Names of your friends who know them (compressed for display). */
    viaLabel: string;
    mutualCount: number;
  }[];
  incoming: {
    id: string;
    from: { userId: string; handle: string | null; label: string };
  }[];
  outgoing: {
    id: string;
    to: { userId: string; handle: string | null; label: string };
  }[];
};

const MAX_FRIEND_SUGGESTIONS = 10;

/** People your friends know (2nd degree), with a handle, excluding you and existing/pending connections. */
async function getFriendOfFriendSuggestions(
  viewerId: string,
  friendIds: string[],
  friendLabelById: Map<string, string>,
  pendingToIds: string[],
  pendingFromIds: string[],
): Promise<FriendsStatePayload["suggestions"]> {
  if (friendIds.length === 0) return [];

  const friendSet = new Set(friendIds);
  const pendingTo = new Set(pendingToIds);
  const pendingFrom = new Set(pendingFromIds);

  const edges = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: { in: friendIds } }, { userBId: { in: friendIds } }],
    },
    select: { userAId: true, userBId: true },
  });

  const candidateConnectors = new Map<string, Set<string>>();

  for (const { userAId: a, userBId: b } of edges) {
    const consider = (connector: string, candidate: string) => {
      if (candidate === viewerId || friendSet.has(candidate)) return;
      if (pendingTo.has(candidate) || pendingFrom.has(candidate)) return;
      let s = candidateConnectors.get(candidate);
      if (!s) {
        s = new Set();
        candidateConnectors.set(candidate, s);
      }
      s.add(connector);
    };

    if (friendSet.has(a)) consider(a, b);
    if (friendSet.has(b)) consider(b, a);
  }

  const candidateIds = [...candidateConnectors.keys()];
  if (candidateIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: candidateIds },
      handle: { not: null },
    },
    select: userPublicSelect,
  });

  const rows: FriendsStatePayload["suggestions"] = [];

  for (const u of users) {
    if (!u.handle) continue;
    const connectors = candidateConnectors.get(u.id);
    if (!connectors || connectors.size === 0) continue;
    const connLabels = [...connectors]
      .map((id) => friendLabelById.get(id) ?? "Friend")
      .sort((x, y) => x.localeCompare(y));

    let viaLabel: string;
    if (connLabels.length === 1) {
      viaLabel = connLabels[0];
    } else if (connLabels.length === 2) {
      viaLabel = `${connLabels[0]} and ${connLabels[1]}`;
    } else {
      viaLabel = `${connLabels[0]} and ${connLabels.length - 1} others`;
    }

    rows.push({
      userId: u.id,
      handle: u.handle,
      label: publicLabel(u),
      hasAvatar: u.avatarBytes != null && u.avatarBytes.length > 0,
      viaLabel,
      mutualCount: connectors.size,
    });
  }

  rows.sort((a, b) => {
    if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount;
    return a.label.localeCompare(b.label);
  });

  return rows.slice(0, MAX_FRIEND_SUGGESTIONS);
}

export async function getFriendsState(userId: string): Promise<FriendsStatePayload> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true },
  });

  const friendIds = await getFriendUserIds(userId);
  const friends =
    friendIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: friendIds } },
          select: friendPublicSelect,
        });

  const friendLabelById = new Map(
    friends.map((u) => [u.id, publicLabel(u)] as const),
  );

  const [incomingRows, outgoingRows] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { toUserId: userId },
      include: { fromUser: { select: userPublicSelect } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: userId },
      include: { toUser: { select: userPublicSelect } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const suggestions = await getFriendOfFriendSuggestions(
    userId,
    friendIds,
    friendLabelById,
    outgoingRows.map((r) => r.toUser.id),
    incomingRows.map((r) => r.fromUser.id),
  );

  const now = new Date();
  return {
    myHandle: me?.handle ?? null,
    friends: friends.map((u) => {
      const ends = u.activeFocusEndsAt;
      const active =
        ends != null && ends.getTime() > now.getTime() ? ends.toISOString() : null;
      const proj = u.activeFocusProject;
      const activeFocusProjectName =
        active && proj
          ? proj.isMisc
            ? "General"
            : proj.name
          : null;
      return {
        userId: u.id,
        handle: u.handle,
        label: publicLabel(u),
        hasAvatar: u.avatarBytes != null && u.avatarBytes.length > 0,
        activeFocusEndsAt: active,
        activeFocusProjectName,
      };
    }),
    suggestions,
    incoming: incomingRows.map((r) => ({
      id: r.id,
      from: {
        userId: r.fromUser.id,
        handle: r.fromUser.handle,
        label: publicLabel(r.fromUser),
      },
    })),
    outgoing: outgoingRows.map((r) => ({
      id: r.id,
      to: {
        userId: r.toUser.id,
        handle: r.toUser.handle,
        label: publicLabel(r.toUser),
      },
    })),
  };
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const [x, y] = friendshipKeyPair(a, b);
  const row = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: x, userBId: y } },
    select: { userAId: true },
  });
  return row != null;
}
