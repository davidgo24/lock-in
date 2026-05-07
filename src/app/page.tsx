import { ActivityApp } from "@/components/ActivityApp";
import { ensureDefaultData } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { getStatsBundle } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDefaultData();
  const rows = await prisma.project.findMany({
    orderBy: [{ isMisc: "desc" }, { name: "asc" }],
  });
  const initialProjects = rows.map((p) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
  }));
  const initialStats = await getStatsBundle();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-[#0a0f1a] to-slate-950">
      <ActivityApp
        initialProjects={initialProjects}
        initialStats={initialStats}
      />
    </div>
  );
}
