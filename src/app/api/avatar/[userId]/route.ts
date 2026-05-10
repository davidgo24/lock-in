import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { areFriends } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const viewerId = await getSessionUserId();
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await ctx.params;
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (viewerId !== userId) {
    const ok = await areFriends(viewerId, userId);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarBytes: true, avatarMime: true },
  });

  if (!u?.avatarBytes || !u.avatarMime) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = new Uint8Array(u.avatarBytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": u.avatarMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
