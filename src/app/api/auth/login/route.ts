import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { COOKIE, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD ?? "";
  const given = String(body.password ?? "");
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  const ok =
    a.length === b.length &&
    a.length > 0 &&
    timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
