import { prisma } from "@/lib/prisma";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Calendar day the user "joined": first activity day, else first project created (local calendar). */
export async function getHeatmapRangeStartKey(userId: string): Promise<string> {
  const [earliestSession, earliestProject] = await Promise.all([
    prisma.activitySession.findFirst({
      where: { project: { userId } },
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
    return earliestSession.workDate.toISOString().slice(0, 10);
  }
  if (earliestProject) {
    const d = earliestProject.createdAt;
    return localYmd(d);
  }
  return localYmd(new Date());
}

export async function getStatsBundle(userId: string) {
  const endD = new Date();
  const endKey = localYmd(endD);

  let startKey = await getHeatmapRangeStartKey(userId);
  if (startKey > endKey) {
    startKey = endKey;
  }

  const gte = new Date(`${startKey}T00:00:00.000Z`);
  const lte = new Date(`${endKey}T00:00:00.000Z`);

  const rows = await prisma.activitySession.groupBy({
    by: ["workDate"],
    where: {
      project: { userId },
      workDate: { gte, lte },
    },
    _sum: { durationSec: true },
  });

  const heatmap: Record<string, number> = {};
  let totalSecYear = 0;
  const datesWithActivity = new Set<string>();

  for (const r of rows) {
    const key = r.workDate.toISOString().slice(0, 10);
    const sec = r._sum.durationSec ?? 0;
    heatmap[key] = sec;
    totalSecYear += sec;
    if (sec > 0) datesWithActivity.add(key);
  }

  let streak = 0;
  const cursor = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  while (true) {
    const k = localYmd(cursor);
    if (datesWithActivity.has(k)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  const day = endD.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  monday.setDate(monday.getDate() + mondayOffset);
  const weekStartKey = localYmd(monday);
  const weekStart = new Date(`${weekStartKey}T00:00:00.000Z`);

  const weekSessions = await prisma.activitySession.findMany({
    where: {
      project: { userId },
      workDate: { gte: weekStart, lte: lte },
    },
    select: { durationSec: true },
  });
  const weeklySec = weekSessions.reduce((a, x) => a + x.durationSec, 0);

  const sessionCount = await prisma.activitySession.count({
    where: { project: { userId } },
  });

  const activeProjectsCount = await prisma.project.count({
    where: { userId },
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

export type StatsBundle = Awaited<ReturnType<typeof getStatsBundle>>;
