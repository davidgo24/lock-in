import { NextResponse } from "next/server";
import { getStatsBundle } from "@/lib/stats";

export async function GET() {
  const stats = await getStatsBundle();
  return NextResponse.json(stats);
}
