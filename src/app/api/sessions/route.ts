import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseWorkDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    projectId?: string;
    summary?: string;
    durationSec?: number;
    workDate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "");
  const summary = String(body.summary ?? "").trim();
  const durationSec = Number(body.durationSec);
  const workDate = parseWorkDate(String(body.workDate ?? ""));

  if (!projectId || !workDate) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!Number.isFinite(durationSec) || durationSec < 60 || durationSec > 24 * 3600) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  if (summary.length < 1 || summary.length > 4000) {
    return NextResponse.json(
      { error: "Please describe what you accomplished" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await prisma.activitySession.create({
    data: {
      projectId,
      summary,
      durationSec: Math.round(durationSec),
      workDate,
    },
  });

  return NextResponse.json({ session });
}
