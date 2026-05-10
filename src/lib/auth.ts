import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import {
  getSessionSecretKeyBytes,
  requireSessionSecretKeyBytes,
} from "@/lib/session-key";

export const COOKIE = "activity_session";

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(requireSessionSecretKeyBytes());
}

/** Verify JWT and return user id from `sub`, or null. */
export async function getUserIdFromTokenString(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const key = getSessionSecretKeyBytes();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return getUserIdFromTokenString(jar.get(COOKIE)?.value);
}
