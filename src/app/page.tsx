import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ActivityApp } from "@/components/ActivityApp";
import { ensureDefaultData } from "@/lib/bootstrap";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFriendsState } from "@/lib/friends";
import { getStatsBundle, getProjectSessionAggregates } from "@/lib/stats";
import {
  getFriendFeedForClient,
  getRecentEntriesForClient,
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

  type SidebarProject = {
    id: string;
    name: string;
    isMisc: boolean;
    archivedAt: Date | null;
  };

  const [projectRowsRaw, initialStats, initialWorkEntries, friendsState, initialFriendFeed, projectAggs] =
    await Promise.all([
      prisma.project.findMany({
        where: { userId },
        orderBy: [{ isMisc: "desc" }, { name: "asc" }],
      }),
      getStatsBundle(userId),
      getRecentEntriesForClient(userId),
      getFriendsState(userId),
      getFriendFeedForClient(userId),
      getProjectSessionAggregates(userId),
    ]);

  const projectRows: SidebarProject[] = projectRowsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
    archivedAt: (p as { archivedAt?: Date | null }).archivedAt ?? null,
  }));

  const activeProjectRows = projectRows.filter((p) => p.archivedAt == null);
  const archivedProjectRows = projectRows.filter((p) => p.archivedAt != null);

  const { totalSecByProjectId, lastSessionAtByProjectId } = projectAggs;

  const initialProjects = activeProjectRows.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
    totalSec: totalSecByProjectId[p.id] ?? 0,
    lastSessionAt: lastSessionAtByProjectId[p.id] ?? null,
  }));

  const initialArchivedProjects = archivedProjectRows.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
    totalSec: totalSecByProjectId[p.id] ?? 0,
    lastSessionAt: lastSessionAtByProjectId[p.id] ?? null,
  }));

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-[var(--background)]">
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center text-sm text-[var(--app-muted)]">
            Loading…
          </div>
        }
      >
        <ActivityApp
          initialProjects={initialProjects}
          initialArchivedProjects={initialArchivedProjects}
          initialStats={initialStats}
          initialWorkEntries={initialWorkEntries}
          initialFriendFeed={initialFriendFeed}
          initialFriendsState={friendsState}
          displayName={displayName}
          appName={appName}
        />
      </Suspense>
    </div>
  );
}
