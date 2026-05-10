import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getFriendsState } from "@/lib/friends";
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

  const del = await prisma.friendRequest.deleteMany({
    where: { id: requestId, fromUserId: userId },
  });

  if (del.count === 0) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const state = await getFriendsState(userId);
  return NextResponse.json(state);
}
