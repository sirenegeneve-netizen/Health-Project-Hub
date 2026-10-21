import { NextRequest, NextResponse } from "next/server";
import { computeHealthScore } from "@/lib/healthScore";
import { requireUser } from "@/lib/auth";
import { guardInitiative } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const __g = await guardInitiative(params.id, "voir");
  if (!__g.ok) return __g.response;

  const score = await computeHealthScore(params.id);
  return NextResponse.json(score);
}
