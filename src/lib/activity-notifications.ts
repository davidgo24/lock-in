import { prisma } from "@/lib/prisma";
import { publicLabel } from "@/lib/friends";

const actorSelect = {
  id: true,
  displayName: true,
  handle: true,
} as const;

export type ActivityNotificationItem = {
  id: string;
  type: "CLAP" | "COMMENT";
  readAt: string | null;
  createdAt: string;
  actorLabel: string;
  sessionId: string;
  sessionSummarySnippet: string;
};

function snippet(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function listNotificationsForUser(
  userId: string,
  take = 40,
): Promise<{
  items: ActivityNotificationItem[];
  unreadCount: number;
}> {
  const [rows, unreadCount] = await Promise.all([
    prisma.activityNotification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        readAt: true,
        createdAt: true,
        sessionId: true,
        actor: { select: actorSelect },
        session: { select: { summary: true } },
      },
    }),
    prisma.activityNotification.count({
      where: { recipientId: userId, readAt: null },
    }),
  ]);

  const items: ActivityNotificationItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    actorLabel: publicLabel(r.actor),
    sessionId: r.sessionId,
    sessionSummarySnippet: snippet(r.session.summary),
  }));

  return { items, unreadCount };
}

export async function markNotificationsRead(
  userId: string,
  ids: string[] | "all",
): Promise<void> {
  if (ids === "all") {
    await prisma.activityNotification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return;
  }
  if (ids.length === 0) return;
  await prisma.activityNotification.updateMany({
    where: { recipientId: userId, id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
}
