import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setReactionEmoji } from "@/lib/activity-social";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Set or toggle a single-emoji reaction. Body optional: `{ "emoji": "❤️" }` (default 👏). */
export async function POST(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;

  let emoji = "👏";
  const text = await req.text();
  if (text.trim()) {
    try {
      const body = JSON.parse(text) as { emoji?: unknown };
      if (typeof body.emoji === "string") emoji = body.emoji;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  try {
    const result = await setReactionEmoji(userId, sessionId, emoji);
    return NextResponse.json(result);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "BAD_REQUEST") {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 },
      );
    }
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw e;
  }
}
