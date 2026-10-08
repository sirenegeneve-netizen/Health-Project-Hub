import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Retire le lien (le risque, la décision, le constat ou l'exigence eux-mêmes ne sont jamais touchés).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const link = await prisma.strategicGoalLink.findUnique({ where: { id: params.id }, include: { strategicGoalCycle: { select: { id: true, strategicGoal: { select: { libelle: true } } } } } });
  if (!link) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  await prisma.strategicGoalLink.delete({ where: { id: params.id } });
  const kind = link.riskId ? "risque" : link.decisionId ? "decision" : link.auditFindingId ? "constat" : "exigence";
  await logAudit({ entityType: "objectif", entityId: link.strategicGoalCycleId, entityLabel: link.strategicGoalCycle.strategicGoal.libelle.slice(0, 120), action: "update", changes: { [`lien_${kind}`]: { from: "associé", to: null } }, user });
  return NextResponse.json({ ok: true });
}
