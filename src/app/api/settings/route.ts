import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.appSettings.findUnique({ where: { userId } });
  return NextResponse.json({
    weeklyGoalHours: row?.weeklyGoalHours ?? 7,
  });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    where: { userId },
    create: { userId, weeklyGoalHours: h },
    update: { weeklyGoalHours: h },
  });

  return NextResponse.json({ weeklyGoalHours: row.weeklyGoalHours });
}
