import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE } from "@/lib/auth";
import { getSessionSecretKeyBytes } from "@/lib/session-key";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) return NextResponse.next();
  if (pathname.startsWith("/signup")) return NextResponse.next();
  if (pathname === "/api/auth/login" || pathname === "/api/auth/signup") {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  const key = getSessionSecretKeyBytes();

  if (!token || !key) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new Error("Invalid subject");
    }
    // Pre-multi-user apps issued JWTs with sub "me"; those IDs are not real User rows.
    if (payload.sub === "me") {
      throw new Error("Legacy session");
    }
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
