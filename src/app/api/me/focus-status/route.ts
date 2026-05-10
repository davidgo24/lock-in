import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_MS = 25 * 60 * 60 * 1000;

/** Start/stop “friend can see I’m in a focus block” (timer end time, or null). */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endsAt?: string | null; projectId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.endsAt == null) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeFocusEndsAt: null, activeFocusProjectId: null },
    });
    return NextResponse.json({ ok: true });
  }

  const end = new Date(String(body.endsAt));
  const now = Date.now();
  if (Number.isNaN(end.getTime()) || end.getTime() <= now) {
    return NextResponse.json({ error: "Invalid endsAt" }, { status: 400 });
  }
  if (end.getTime() - now > MAX_MS) {
    return NextResponse.json({ error: "Timer too long" }, { status: 400 });
  }

  let activeFocusProjectId: string | null = null;
  const rawPid = body.projectId;
  if (rawPid != null && String(rawPid).trim() !== "") {
    const proj = await prisma.project.findFirst({
      where: { id: String(rawPid), userId },
      select: { id: true },
    });
    if (proj) activeFocusProjectId = proj.id;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeFocusEndsAt: end, activeFocusProjectId },
  });
  return NextResponse.json({ ok: true });
}
