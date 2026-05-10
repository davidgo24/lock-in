import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  areFriends,
  friendshipKeyPair,
  getFriendsState,
} from "@/lib/friends";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { handle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = String(body.handle ?? "");
  const normalized = normalizeHandleInput(raw);
  const verr = validateHandle(normalized);
  if (verr) {
    return NextResponse.json({ error: verr }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { handle: normalized },
    select: { id: true, handle: true },
  });

  if (!target) {
    return NextResponse.json({ error: "No user with that handle." }, { status: 404 });
  }

  if (target.id === userId) {
    return NextResponse.json({ error: "You cannot add yourself." }, { status: 400 });
  }

  if (await areFriends(userId, target.id)) {
    return NextResponse.json({ error: "Already friends." }, { status: 409 });
  }

  const reversePending = await prisma.friendRequest.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId: target.id, toUserId: userId },
    },
    select: { id: true },
  });
  if (reversePending) {
    return NextResponse.json(
      {
        error:
          "They already sent you a request — accept it under Incoming below.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.friendRequest.create({
      data: { fromUserId: userId, toUserId: target.id },
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A request is already pending to this person." },
        { status: 409 },
      );
    }
    throw e;
  }

  const state = await getFriendsState(userId);
  return NextResponse.json(state);
}
