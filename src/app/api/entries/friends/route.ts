import { NextResponse } from "next/server";
import {
  getFriendsWorkEntries,
  mapFriendFeedEntryToClient,
} from "@/lib/work-entries";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getFriendsWorkEntries(userId);
  const entries = rows.map(mapFriendFeedEntryToClient);
  return NextResponse.json({ entries });
}
