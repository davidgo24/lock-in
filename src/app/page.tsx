import { ActivityApp } from "@/components/ActivityApp";
import { ensureDefaultData } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { getStatsBundle } from "@/lib/stats";
import { getRecentWorkEntries } from "@/lib/work-entries";

/** Matches fields selected by prisma.project.findMany() for this page. */
type ProjectListRow = {
  id: string;
  name: string;
  isMisc: boolean;
};

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDefaultData();
  const [projectRows, initialStats, entryRows] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ isMisc: "desc" }, { name: "asc" }],
    }) as Promise<ProjectListRow[]>,
    getStatsBundle(),
    getRecentWorkEntries(),
  ]);

  const initialProjects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
  }));

  const initialWorkEntries = entryRows.map((e) => ({
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: e.project,
  }));

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-gradient-to-b from-slate-950 via-[#0a0f1a] to-slate-950">
      <ActivityApp
        initialProjects={initialProjects}
        initialStats={initialStats}
        initialWorkEntries={initialWorkEntries}
      />
    </div>
  );
}
