import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureBaselineAction } from "@/lib/baselineDb";

// Propose (crée ou réutilise) l'action « Audit de départ » d'un indicateur sans valeur initiale.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const ind = await prisma.goalIndicator.findUnique({ where: { id: params.id }, select: { id: true, strategicGoalCycleId: true, valeurInitiale: true } });
  if (!ind) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });
  if (ind.valeurInitiale !== null) return NextResponse.json({ error: "La valeur initiale est déjà renseignée : aucun audit de départ à créer." }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const res = await ensureBaselineAction({ cycleId: ind.strategicGoalCycleId, indicatorIds: [ind.id], overrides: body });
  if (!res) return NextResponse.json({ error: "Action non créée." }, { status: 400 });
  return NextResponse.json(res, { status: res.created ? 201 : 200 });
}
