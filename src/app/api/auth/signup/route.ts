import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureDefaultData } from "@/lib/bootstrap";
import { ensureWelcomeFriendship } from "@/lib/welcome-friend";
import { COOKIE, createSessionToken } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import { logWarn } from "@/lib/log";

import { normalizeHandleInput, validateHandle } from "@/lib/handle";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_MAX = 8;

export async function POST(req: Request) {
  const ip = clientKeyFromRequest(req);
  const limited = checkRateLimit(`auth:signup:${ip}`, SIGNUP_MAX, SIGNUP_WINDOW_MS);
  if (!limited.ok) {
    logWarn("rate_limit.signup", { ip: ip === "unknown" ? ip : "[redacted]" });
    return NextResponse.json(
      { error: "Too many signups from this network. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: {
    email?: string;
    password?: string;
    displayName?: string;
    handle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    return NextResponse.json({ error: "An account with this email already exists" }, {
      status: 409,
    });
  }

  let handle: string | null = null;
  if (typeof body.handle === "string" && body.handle.trim().length > 0) {
    const h = normalizeHandleInput(body.handle);
    const herr = validateHandle(h);
    if (herr) {
      return NextResponse.json({ error: herr }, { status: 400 });
    }
    const ht = await prisma.user.findUnique({
      where: { handle: h },
      select: { id: true },
    });
    if (ht) {
      return NextResponse.json({ error: "That handle is already taken." }, {
        status: 409,
      });
    }
    handle = h;
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: displayName.length > 0 ? displayName.slice(0, 80) : null,
      handle,
    },
  });

  await ensureDefaultData(user.id);
  await ensureWelcomeFriendship(user.id).catch(() => {});

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
