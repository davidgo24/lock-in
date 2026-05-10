import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  deleteMyComment,
  upsertActivityComment,
} from "@/lib/activity-social";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Create or update your single comment on a friend&apos;s session. */
export async function POST(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body : "";
  try {
    await upsertActivityComment(userId, sessionId, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    const msg = e instanceof Error ? e.message : "Error";
    if (code === "BAD_REQUEST") {
      return NextResponse.json({ error: msg }, { status: 400 });
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

export async function DELETE(_req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  try {
    await deleteMyComment(userId, sessionId);
    return NextResponse.json({ ok: true });
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
