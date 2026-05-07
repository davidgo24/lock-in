import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    weeklyGoalHours: row?.weeklyGoalHours ?? 7,
  });
}

export async function PATCH(req: Request) {
  let body: { weeklyGoalHours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const h = Number(body.weeklyGoalHours);
  if (!Number.isFinite(h) || h < 0.5 || h > 168) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  const row = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", weeklyGoalHours: h },
    update: { weeklyGoalHours: h },
  });

  return NextResponse.json({ weeklyGoalHours: row.weeklyGoalHours });
}
