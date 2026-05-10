import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { COOKIE, createSessionToken } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import { logWarn } from "@/lib/log";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 25;

export async function POST(req: Request) {
  const ip = clientKeyFromRequest(req);
  const limited = checkRateLimit(`auth:login:${ip}`, LOGIN_MAX, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    logWarn("rate_limit.login", { ip: ip === "unknown" ? ip : "[redacted]" });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
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
