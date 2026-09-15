import { NextRequest, NextResponse } from "next/server";
import { computeHealthScore } from "@/lib/healthScore";
import { requireUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const score = await computeHealthScore(params.id);
  return NextResponse.json(score);
}
