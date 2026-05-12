import type { ActivityNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { areFriends, publicLabel } from "@/lib/friends";
import { normalizeReactionEmoji } from "@/lib/emoji-reaction";

const COMMENT_MAX = 500;

export type ActivitySocialComment = {
  authorLabel: string;
  authorUserId: string;
  authorHasAvatar: boolean;
  body: string;
  createdAt: string;
};

export type ReactionBreakdownRow = { emoji: string; count: number };

export type ActivitySocialPayload = {
  clapCount: number;
  clappedByMe: boolean;
  /** Your current reaction emoji, if any. */
  myReactionEmoji: string | null;
  /** Per-emoji counts for this session. */
  reactionBreakdown: ReactionBreakdownRow[];
  comments: ActivitySocialComment[];
  myComment: string | null;
};

export type ReactionMutationResult = {
  clappedByMe: boolean;
  clapCount: number;
  myReactionEmoji: string | null;
  reactionBreakdown: ReactionBreakdownRow[];
};

export async function getSessionOwnerId(sessionId: string): Promise<string | null> {
  const row = await prisma.activitySession.findUnique({
    where: { id: sessionId },
    select: { project: { select: { userId: true } } },
  });
  return row?.project.userId ?? null;
}

/** Friend can react only if they are friends with the session owner and are not the owner. */
export async function assertFriendCanReact(
  viewerId: string,
  sessionId: string,
): Promise<{ ownerId: string }> {
  const ownerId = await getSessionOwnerId(sessionId);
  if (!ownerId) {
    const err = new Error("NOT_FOUND") as Error & { code: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  if (ownerId === viewerId) {
    const err = new Error("FORBIDDEN") as Error & { code: string };
    err.code = "FORBIDDEN";
    throw err;
  }
  const ok = await areFriends(viewerId, ownerId);
  if (!ok) {
    const err = new Error("FORBIDDEN") as Error & { code: string };
    err.code = "FORBIDDEN";
    throw err;
  }
  return { ownerId };
}

export function normalizeCommentBody(raw: string): string {
  const t = raw.trim();
  return t.slice(0, COMMENT_MAX);
}

export function validateCommentBody(raw: string): string | null {
  const t = normalizeCommentBody(raw);
  if (t.length < 1) return "Comment cannot be empty.";
  if (t.length > COMMENT_MAX) return `Comment must be at most ${COMMENT_MAX} characters.`;
  return null;
}

export async function notifyActivityEvent(opts: {
  recipientId: string;
  actorId: string;
  sessionId: string;
  type: ActivityNotificationType;
}): Promise<void> {
  if (opts.recipientId === opts.actorId) return;
  await prisma.activityNotification.create({
    data: {
      recipientId: opts.recipientId,
      actorId: opts.actorId,
      sessionId: opts.sessionId,
      type: opts.type,
    },
  });
}

async function reactionBreakdownForSession(
  sessionId: string,
): Promise<ReactionBreakdownRow[]> {
  const rows = await prisma.activityClap.groupBy({
    by: ["emoji"],
    where: { sessionId },
    _count: { emoji: true },
  });
  return rows
    .map((r) => ({ emoji: r.emoji, count: r._count.emoji }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/**
 * Set or toggle a single-emoji reaction. Same emoji again removes it; a different emoji replaces.
 */
export async function setReactionEmoji(
  viewerId: string,
  sessionId: string,
  rawEmoji: string,
): Promise<ReactionMutationResult> {
  const normalized = normalizeReactionEmoji(rawEmoji);
  if (!normalized) {
    const err = new Error("Pick one emoji.") as Error & { code: string };
    err.code = "BAD_REQUEST";
    throw err;
  }

  const { ownerId } = await assertFriendCanReact(viewerId, sessionId);

  const existing = await prisma.activityClap.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewerId } },
  });

  if (existing && existing.emoji === normalized) {
    await prisma.activityClap.delete({
      where: { sessionId_userId: { sessionId, userId: viewerId } },
    });
  } else if (existing) {
    await prisma.activityClap.update({
      where: { sessionId_userId: { sessionId, userId: viewerId } },
      data: { emoji: normalized },
    });
  } else {
    await prisma.activityClap.create({
      data: { sessionId, userId: viewerId, emoji: normalized },
    });
    await notifyActivityEvent({
      recipientId: ownerId,
      actorId: viewerId,
      sessionId,
      type: "CLAP",
    });
  }

  const clapCount = await prisma.activityClap.count({ where: { sessionId } });
  const my = await prisma.activityClap.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewerId } },
    select: { emoji: true },
  });
  const reactionBreakdown = await reactionBreakdownForSession(sessionId);
  return {
    clappedByMe: my != null,
    clapCount,
    myReactionEmoji: my?.emoji ?? null,
    reactionBreakdown,
  };
}

export async function upsertActivityComment(
  viewerId: string,
  sessionId: string,
  body: string,
): Promise<{ isNew: boolean }> {
  const errMsg = validateCommentBody(body);
  if (errMsg) {
    const err = new Error(errMsg) as Error & { code: string };
    err.code = "BAD_REQUEST";
    throw err;
  }
  const normalized = normalizeCommentBody(body);
  const { ownerId } = await assertFriendCanReact(viewerId, sessionId);

  const prior = await prisma.activityComment.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewerId } },
  });

  await prisma.activityComment.upsert({
    where: { sessionId_userId: { sessionId, userId: viewerId } },
    create: { sessionId, userId: viewerId, body: normalized },
    update: { body: normalized },
  });

  if (!prior) {
    await notifyActivityEvent({
      recipientId: ownerId,
      actorId: viewerId,
      sessionId,
      type: "COMMENT",
    });
  }

  return { isNew: !prior };
}

export async function deleteMyComment(
  viewerId: string,
  sessionId: string,
): Promise<void> {
  await assertFriendCanReact(viewerId, sessionId);
  await prisma.activityComment.deleteMany({
    where: { sessionId, userId: viewerId },
  });
}

const commentUserSelect = {
  id: true,
  displayName: true,
  handle: true,
  avatarBytes: true,
} as const;

type CommentWithUser = {
  body: string;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    handle: string | null;
    avatarBytes: Uint8Array | null;
  };
};

function mapComment(c: CommentWithUser): ActivitySocialComment {
  return {
    authorLabel: publicLabel(c.user),
    authorUserId: c.user.id,
    authorHasAvatar:
      c.user.avatarBytes != null && c.user.avatarBytes.length > 0,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Batch-load social state for many sessions (single viewer). */
export async function getSocialBySessionIds(
  sessionIds: string[],
  viewerId: string,
): Promise<Map<string, ActivitySocialPayload>> {
  const map = new Map<string, ActivitySocialPayload>();
  if (sessionIds.length === 0) return map;

  const [clapRows, allComments, myComments] = await Promise.all([
    prisma.activityClap.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, userId: true, emoji: true },
    }),
    prisma.activityComment.findMany({
      where: { sessionId: { in: sessionIds } },
      select: {
        sessionId: true,
        body: true,
        createdAt: true,
        user: { select: commentUserSelect },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityComment.findMany({
      where: { sessionId: { in: sessionIds }, userId: viewerId },
      select: { sessionId: true, body: true },
    }),
  ]);

  const countMap: Record<string, number> = {};
  const breakdownMaps = new Map<string, Map<string, number>>();
  const myReactionMap: Record<string, string> = {};

  for (const sid of sessionIds) {
    countMap[sid] = 0;
    breakdownMaps.set(sid, new Map());
  }
  for (const row of clapRows) {
    countMap[row.sessionId] = (countMap[row.sessionId] ?? 0) + 1;
    const m = breakdownMaps.get(row.sessionId);
    if (m) {
      m.set(row.emoji, (m.get(row.emoji) ?? 0) + 1);
    }
    if (row.userId === viewerId) {
      myReactionMap[row.sessionId] = row.emoji;
    }
  }

  const myClapSet = new Set(
    Object.entries(myReactionMap).map(([sessionId]) => sessionId),
  );
  const myCommentMap = Object.fromEntries(
    myComments.map((c) => [c.sessionId, c.body]),
  );

  const commentsBySession = new Map<string, ActivitySocialComment[]>();
  for (const sid of sessionIds) commentsBySession.set(sid, []);
  for (const row of allComments) {
    const list = commentsBySession.get(row.sessionId);
    if (!list) continue;
    if (list.length < 8) list.push(mapComment(row));
  }

  for (const sid of sessionIds) {
    const bm = breakdownMaps.get(sid);
    const reactionBreakdown: ReactionBreakdownRow[] = bm
      ? [...bm.entries()]
          .map(([emoji, count]) => ({ emoji, count }))
          .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
      : [];
    map.set(sid, {
      clapCount: countMap[sid] ?? 0,
      clappedByMe: myClapSet.has(sid),
      myReactionEmoji: myReactionMap[sid] ?? null,
      reactionBreakdown,
      comments: commentsBySession.get(sid) ?? [],
      myComment: myCommentMap[sid] ?? null,
    });
  }

  return map;
}
