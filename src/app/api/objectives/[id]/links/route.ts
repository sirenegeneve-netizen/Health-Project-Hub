import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isLinkKind, isLinkNature } from "@/lib/objectifs";
import { addObjectiveLink } from "@/lib/objectifsDb";

// Relie à l'objectif un risque, une décision, un constat d'audit ou une exigence EXISTANTS (aucune duplication).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  if (!isLinkKind(body.kind) || !body.targetId) return NextResponse.json({ error: "kind (risque | decision | constat | exigence) et targetId requis." }, { status: 400 });
  const nature = body.nature === undefined ? "associe" : body.nature;
  if (!isLinkNature(nature)) return NextResponse.json({ error: "Nature invalide." }, { status: 400 });

  const res = await addObjectiveLink(params.id, body.kind, String(body.targetId), nature);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });

  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: params.id }, select: { strategicGoal: { select: { libelle: true } } } });
  await logAudit({ entityType: "objectif", entityId: params.id, entityLabel: (cycle?.strategicGoal.libelle || params.id).slice(0, 120), action: "update", changes: { [`lien_${body.kind}`]: { from: null, to: "associé" } }, user });
  return NextResponse.json({ id: res.id }, { status: 201 });
}
