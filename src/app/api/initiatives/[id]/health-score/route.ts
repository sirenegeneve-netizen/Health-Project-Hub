import { NextRequest, NextResponse } from "next/server";
import { computeHealthScore } from "@/lib/healthScore";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const score = await computeHealthScore(params.id);
  return NextResponse.json(score);
}
