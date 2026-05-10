import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { AVATAR_MAX_BYTES, AVATAR_MAX_MIB, validateAvatarFile } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected file field" }, { status: 400 });
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: `Image must be at most ${AVATAR_MAX_MIB} MB.` },
      { status: 400 },
    );
  }

  const ab = await file.arrayBuffer();
  const buf = new Uint8Array(ab);
  const ok = validateAvatarFile(buf);
  if (!ok) {
    return NextResponse.json(
      {
        error: `Use a JPEG, PNG, GIF, or WebP image (${AVATAR_MAX_MIB} MB max).`,
      },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarBytes: Buffer.from(buf),
      avatarMime: ok.mime,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarBytes: null, avatarMime: null },
  });

  return NextResponse.json({ ok: true });
}
