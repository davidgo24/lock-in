import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/activity-notifications";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { all?: boolean; ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.all === true) {
    await markNotificationsRead(userId, "all");
    return NextResponse.json({ ok: true });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  await markNotificationsRead(userId, ids);
  return NextResponse.json({ ok: true });
}
