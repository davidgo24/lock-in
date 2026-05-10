import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { friendshipKeyPair, getFriendsState } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { requestId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestId = String(body.requestId ?? "");
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const row = await prisma.friendRequest.findFirst({
    where: { id: requestId, toUserId: userId },
    select: { fromUserId: true, toUserId: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const [a, b] = friendshipKeyPair(row.fromUserId, row.toUserId);

  await prisma.$transaction([
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: row.fromUserId, toUserId: row.toUserId },
          { fromUserId: row.toUserId, toUserId: row.fromUserId },
        ],
      },
    }),
    prisma.friendship.create({
      data: { userAId: a, userBId: b },
    }),
  ]);

  const state = await getFriendsState(userId);
  return NextResponse.json(state);
}
