import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  createActivityComment,
  deleteActivityComment,
} from "@/lib/activity-social";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Add a comment (friend) or reply (session owner). */
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
    await createActivityComment(userId, sessionId, text);
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

export async function DELETE(req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let commentId: string | null = null;
  try {
    const body = (await req.json()) as { commentId?: unknown };
    if (typeof body.commentId === "string" && body.commentId.length > 0) {
      commentId = body.commentId;
    }
  } catch {
    /* empty or invalid body */
  }
  if (!commentId) {
    return NextResponse.json(
      { error: "commentId required in JSON body" },
      { status: 400 },
    );
  }
  try {
    await deleteActivityComment(userId, commentId);
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
