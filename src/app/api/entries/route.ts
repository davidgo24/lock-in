import { NextResponse } from "next/server";
import { getRecentWorkEntries } from "@/lib/work-entries";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getRecentWorkEntries(userId);
  const entries = rows.map((e) => ({
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt: e.createdAt.toISOString(),
    workDate: e.workDate.toISOString().slice(0, 10),
    project: e.project,
  }));
  return NextResponse.json({ entries });
}
