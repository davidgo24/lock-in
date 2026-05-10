import { NextResponse } from "next/server";
import { COOKIE, getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const userId = await getSessionUserId();
  if (userId) {
    await prisma.user
      .update({ where: { id: userId }, data: { activeFocusEndsAt: null } })
      .catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
