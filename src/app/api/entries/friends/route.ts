import { NextResponse } from "next/server";
import { getFriendFeedForClient } from "@/lib/work-entries";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getFriendFeedForClient(userId);
  return NextResponse.json({ entries });
}
