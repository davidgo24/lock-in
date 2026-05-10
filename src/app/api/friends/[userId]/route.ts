import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { friendshipKeyPair, getFriendsState } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ userId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: otherId } = await ctx.params;
  if (!otherId || otherId === userId) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const [a, b] = friendshipKeyPair(userId, otherId);

  const del = await prisma.friendship.deleteMany({
    where: { userAId: a, userBId: b },
  });

  if (del.count === 0) {
    return NextResponse.json({ error: "Not friends with this user." }, { status: 404 });
  }

  const state = await getFriendsState(userId);
  return NextResponse.json(state);
}
