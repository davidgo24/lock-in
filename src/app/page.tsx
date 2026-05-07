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
    <div className="min-h-screen bg-zinc-50">
      <ActivityApp
        initialProjects={initialProjects}
        initialStats={initialStats}
      />
    </div>
  );
}
