import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.isMisc) {
    return NextResponse.json({ error: "Cannot delete misc project" }, { status: 400 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
