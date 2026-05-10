import { NextResponse } from "next/server";
import { ensureDefaultData } from "@/lib/bootstrap";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDefaultData(userId);

  const [projects, archivedProjects] = await Promise.all([
    prisma.project.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isMisc: "desc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: { userId, archivedAt: { not: null } },
      orderBy: { name: "asc" },
    }),
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
    totals.map((t) => [t.projectId, t._sum.durationSec ?? 0]),
  );
  const lastMap = Object.fromEntries(
    lastSessions.map((t) => [t.projectId, t._max.createdAt]),
  );

  const mapProject = (p: (typeof projects)[0]) => ({
    id: p.id,
    name: p.name,
    isMisc: p.isMisc,
    totalSec: totalMap[p.id] ?? 0,
    lastSessionAt: lastMap[p.id]?.toISOString() ?? null,
  });

  return NextResponse.json({
    projects: projects.map(mapProject),
    archivedProjects: archivedProjects.map(mapProject),
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { userId, name, isMisc: false },
  });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      isMisc: project.isMisc,
      totalSec: 0,
      lastSessionAt: null,
    },
  });
}
