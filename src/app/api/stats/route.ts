import { NextResponse } from "next/server";
import { getStatsBundle } from "@/lib/stats";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getStatsBundle(userId);
  return NextResponse.json(stats);
}
