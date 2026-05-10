import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getFriendsState } from "@/lib/friends";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getFriendsState(userId);
  return NextResponse.json(state);
}
