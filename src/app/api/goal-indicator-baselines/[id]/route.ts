import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Validation d'une valeur initiale proposée (résultats de l'audit validés) : elle devient la valeur de référence.
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const b = await prisma.goalIndicatorBaseline.findUnique({ where: { id: params.id }, include: { goalIndicator: { include: { strategicGoalCycle: { select: { id: true, strategicGoal: { select: { libelle: true } } } } } } } });
  if (!b) return NextResponse.json({ error: "Valeur introuvable." }, { status: 404 });
  if (b.statut !== "propose") return NextResponse.json({ error: "Seule une valeur proposée peut être validée." }, { status: 409 });
  const ind = b.goalIndicator;
  await prisma.$transaction([
    prisma.goalIndicatorBaseline.updateMany({ where: { goalIndicatorId: ind.id, statut: "valide" }, data: { statut: "remplace" } }),
    prisma.goalIndicatorBaseline.update({ where: { id: b.id }, data: { statut: "valide", validePar: user.name, valideLe: new Date() } }),
    prisma.goalIndicator.update({ where: { id: ind.id }, data: { valeurInitiale: b.valeur } }),
  ]);
  await logAudit({ entityType: "objectif", entityId: ind.strategicGoalCycleId, entityLabel: ind.strategicGoalCycle.strategicGoal.libelle.slice(0, 120), action: "update", changes: { [`${ind.nom}.valeur_initiale`]: { from: ind.valeurInitiale, to: `${b.valeur} (validée)` } }, user });
  return NextResponse.json({ ok: true });
}
