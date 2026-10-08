import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Correction d'une saisie erronée : la suppression d'une mesure est tracée dans le journal.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const measure = await prisma.goalIndicatorMeasure.findUnique({
    where: { id: params.id },
    include: { goalIndicator: { select: { nom: true, strategicGoalCycleId: true, strategicGoalCycle: { select: { strategicGoal: { select: { libelle: true } } } } } } },
  });
  if (!measure) return NextResponse.json({ error: "Mesure introuvable." }, { status: 404 });
  await prisma.goalIndicatorMeasure.delete({ where: { id: params.id } });
  await logAudit({
    entityType: "objectif",
    entityId: measure.goalIndicator.strategicGoalCycleId,
    entityLabel: measure.goalIndicator.strategicGoalCycle.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: { [`${measure.goalIndicator.nom}.mesure_supprimee`]: { from: `${measure.valeur} (${measure.dateMesure.toLocaleDateString("fr-FR")})`, to: null } },
    user,
  });
  return NextResponse.json({ ok: true });
}
