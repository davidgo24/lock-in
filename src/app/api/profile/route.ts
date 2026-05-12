import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, displayName: true, avatarBytes: true },
  });
  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    handle: u.handle,
    displayName: u.displayName,
    hasAvatar: u.avatarBytes != null && u.avatarBytes.length > 0,
  });
}

const DISPLAY_NAME_MAX = 80;

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { handle?: string | null; displayName?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasDisplay = Object.prototype.hasOwnProperty.call(body, "displayName");
  const hasHandle = Object.prototype.hasOwnProperty.call(body, "handle");
  if (!hasDisplay && !hasHandle) {
    return NextResponse.json(
      { error: "Provide displayName and/or handle to update." },
      { status: 400 },
    );
  }

  const data: { handle?: string; displayName?: string | null } = {};

  if (hasDisplay) {
    const raw = body.displayName;
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json(
        { error: "displayName must be a string or null" },
        { status: 400 },
      );
    }
    const dn = typeof raw === "string" ? raw.trim() : "";
    data.displayName = dn.length > 0 ? dn.slice(0, DISPLAY_NAME_MAX) : null;
  }

  if (hasHandle) {
    if (typeof body.handle !== "string") {
      return NextResponse.json(
        { error: "handle must be a string when updating handle" },
        { status: 400 },
      );
    }
    const normalized = normalizeHandleInput(body.handle);
    const err = validateHandle(normalized);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    data.handle = normalized;
  }

  try {
    const u = await prisma.user.update({
      where: { id: userId },
      data,
      select: { handle: true, displayName: true },
    });
    return NextResponse.json({
      handle: u.handle,
      displayName: u.displayName,
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "That handle is already taken." },
        { status: 409 },
      );
    }
    throw e;
  }
}
