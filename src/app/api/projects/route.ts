import { NextResponse } from "next/server";
import { ensureDefaultData } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await ensureDefaultData();
  const projects = await prisma.project.findMany({
    orderBy: [{ isMisc: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name, isMisc: false },
  });

  return NextResponse.json({ project });
}
