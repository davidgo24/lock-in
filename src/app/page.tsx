import { redirect } from "next/navigation";
import { ActivityApp } from "@/components/ActivityApp";
import { ensureDefaultData } from "@/lib/bootstrap";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFriendsState } from "@/lib/friends";
import { getStatsBundle } from "@/lib/stats";
import {
  getFriendsWorkEntries,
  getRecentWorkEntries,
  mapFriendFeedEntryToClient,
} from "@/lib/work-entries";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "5to9 Club";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });

  // Old single-user JWTs used sub "me" — no User row → would break ensureDefaultData (FK).
  if (!user) {
    redirect("/login");
  }

  await ensureDefaultData(userId);

  const displayName =
    user.displayName?.trim() || user.email.split("@")[0] || "You";

  const [projectRows, initialStats, entryRows, friendsState, friendRows] =
    await Promise.all([
      prisma.project.findMany({
        where: { userId },
        orderBy: [{ isMisc: "desc" }, { name: "asc" }],
      }),
      getStatsBundle(userId),
      getRecentWorkEntries(userId),
      getFriendsState(userId),
      getFriendsWorkEntries(userId),
    ]);

  const [totals, lastSessions] = await Promise.all([
    prisma.activitySession.groupBy({
      by: ["projectId"],
      where: { project: { is: { userId } } },
      _sum: { durationSec: true },
    }),
    prisma.activitySession.groupBy({
      by: ["projectId"],
      where: { project: { is: { userId } } },
      _max: { createdAt: true },
    }),
  ]);

  const totalMap = Object.fromEntries(
    totals.map((t) => [t.projectId, t._sum?.durationSec ?? 0]),
  );
  const lastMap = Object.fromEntries(
    lastSessions.map((t) => [t.projectId, t._max?.createdAt]),
  );

  const initialProjects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
    totalSec: totalMap[p.id] ?? 0,
    lastSessionAt: lastMap[p.id]?.toISOString() ?? null,
  }));

  const initialWorkEntries = entryRows.map((e) => ({
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: e.project,
  }));

  const initialFriendFeed = friendRows.map(mapFriendFeedEntryToClient);

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-[var(--background)]">
      <ActivityApp
        initialProjects={initialProjects}
        initialStats={initialStats}
        initialWorkEntries={initialWorkEntries}
        initialFriendFeed={initialFriendFeed}
        initialFriendsState={friendsState}
        displayName={displayName}
        appName={appName}
      />
    </div>
  );
}
