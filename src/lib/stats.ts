import { prisma } from "@/lib/prisma";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Calendar YYYY-MM-DD for a `Date` tied to a Postgres `DATE` / client `workDate` string (UTC midnight). */
export function workDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Calendar day the user "joined": first activity day, else first project created (local calendar). */
export async function getHeatmapRangeStartKey(userId: string): Promise<string> {
  const [earliestSession, earliestProject] = await Promise.all([
    prisma.activitySession.findFirst({
      where: { project: { is: { userId } } },
      orderBy: { workDate: "asc" },
      select: { workDate: true },
    }),
    prisma.project.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  if (earliestSession) {
    return workDateKey(earliestSession.workDate);
  }
  if (earliestProject) {
    const d = earliestProject.createdAt;
    return localYmd(d);
  }
  return localYmd(new Date());
}

export async function getStatsBundle(userId: string) {
  const endD = new Date();
  const endKey = workDateKey(endD);

  let startKey = await getHeatmapRangeStartKey(userId);
  if (startKey > endKey) {
    startKey = endKey;
  }

  const gte = new Date(`${startKey}T00:00:00.000Z`);
  const lte = new Date(`${endKey}T00:00:00.000Z`);

  const rows = await prisma.activitySession.groupBy({
    by: ["workDate"],
    where: {
      project: { is: { userId } },
      workDate: { gte, lte },
    },
    _sum: { durationSec: true },
  });

  const heatmap: Record<string, number> = {};
  let totalSecYear = 0;
  const datesWithActivity = new Set<string>();

  for (const r of rows) {
    const key = workDateKey(r.workDate);
    const sec = r._sum.durationSec ?? 0;
    heatmap[key] = sec;
    totalSecYear += sec;
    if (sec > 0) datesWithActivity.add(key);
  }

  /*
   * Streak = consecutive calendar days with ≥1 session, using UTC dates to match stored `workDate`.
   * If there is nothing logged for "today" UTC yet, we still count from yesterday so the flame
   * doesn't drop to zero until you've actually missed a full calendar day (common before logging).
   */
  let streak = 0;
  const now = new Date();
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!datesWithActivity.has(workDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (streak < 400) {
    const k = workDateKey(cursor);
    if (!datesWithActivity.has(k)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const day = endD.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  monday.setDate(monday.getDate() + mondayOffset);
  const weekStartKey = localYmd(monday);
  const weekStart = new Date(`${weekStartKey}T00:00:00.000Z`);

  const weekSessions = await prisma.activitySession.findMany({
    where: {
      project: { is: { userId } },
      workDate: { gte: weekStart, lte: lte },
    },
    select: { durationSec: true },
  });
  const weeklySec = weekSessions.reduce((a, x) => a + x.durationSec, 0);

  const sessionCount = await prisma.activitySession.count({
    where: { project: { is: { userId } } },
  });

  const activeProjectsCount = await prisma.project.count({
    where: { userId, archivedAt: null },
  });

  const settings = await prisma.appSettings.findUnique({
    where: { userId },
  });
  const weeklyGoalHours = settings?.weeklyGoalHours ?? 7;

  return {
    heatmap,
    heatmapRangeStart: startKey,
    totalMinutesYear: Math.round(totalSecYear / 60),
    streak,
    sessionCount,
    weeklyLoggedMinutes: Math.round(weeklySec / 60),
    weeklyGoalHours,
    activeProjectsCount,
  };
}

/** One query: per-project total duration + last session time (for sidebar labels). */
export async function getProjectSessionAggregates(userId: string): Promise<{
  totalSecByProjectId: Record<string, number>;
  lastSessionAtByProjectId: Record<string, string | null>;
}> {
  const rows = await prisma.activitySession.groupBy({
    by: ["projectId"],
    where: { project: { is: { userId } } },
    _sum: { durationSec: true },
    _max: { createdAt: true },
  });
  const totalSecByProjectId: Record<string, number> = {};
  const lastSessionAtByProjectId: Record<string, string | null> = {};
  for (const r of rows) {
    totalSecByProjectId[r.projectId] = r._sum?.durationSec ?? 0;
    lastSessionAtByProjectId[r.projectId] = r._max?.createdAt?.toISOString() ?? null;
  }
  return { totalSecByProjectId, lastSessionAtByProjectId };
}

export type StatsBundle = Awaited<ReturnType<typeof getStatsBundle>>;
