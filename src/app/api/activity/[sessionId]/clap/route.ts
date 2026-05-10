import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { toggleClap } from "@/lib/activity-social";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Toggle clap on a friend&apos;s session. */
export async function POST(_req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  try {
    const { clappedByMe, clapCount } = await toggleClap(userId, sessionId);
    return NextResponse.json({ clappedByMe, clapCount });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw e;
  }
}
