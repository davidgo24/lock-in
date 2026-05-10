import { NextResponse } from "next/server";
import { getRecentEntriesForClient } from "@/lib/work-entries";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getRecentEntriesForClient(userId);
  return NextResponse.json({ entries });
}
