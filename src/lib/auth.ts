import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "activity_session";

function getKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "me" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getKey());
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}
