import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listNotificationsForUser } from "@/lib/activity-notifications";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await listNotificationsForUser(userId);
  return NextResponse.json(data);
}
