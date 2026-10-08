import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toNumberOrNull } from "@/lib/objectifs";

// Saisie d'une mesure : valeur réellement constatée à une date donnée. La « valeur actuelle » de l'indicateur
// est toujours la dernière mesure ; l'historique est conservé.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const indicator = await prisma.goalIndicator.findUnique({ where: { id: params.id }, include: { strategicGoalCycle: { select: { id: true, strategicGoal: { select: { libelle: true } } } } } });
  if (!indicator) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });

  const body = await req.json();
  const valeur = toNumberOrNull(body.valeur);
  if (valeur === null || Number.isNaN(valeur)) return NextResponse.json({ error: "Une valeur numérique est requise." }, { status: 400 });
  const date = body.dateMesure ? new Date(body.dateMesure) : new Date();
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Date de mesure invalide." }, { status: 400 });

  const measure = await prisma.goalIndicatorMeasure.create({
    data: { goalIndicatorId: indicator.id, valeur, dateMesure: date, commentaire: body.commentaire ? String(body.commentaire) : null, source: body.source ? String(body.source) : null, auteur: user.name },
  });
  await logAudit({
    entityType: "objectif",
    entityId: indicator.strategicGoalCycleId,
    entityLabel: indicator.strategicGoalCycle.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: { [`${indicator.nom}.mesure`]: { from: null, to: `${valeur}${indicator.unite ? " " + indicator.unite : ""} (${date.toLocaleDateString("fr-FR")})` } },
    user,
  });
  return NextResponse.json(measure, { status: 201 });
}
