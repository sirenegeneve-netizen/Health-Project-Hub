import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toNumberOrNull } from "@/lib/objectifs";
import { guardRecord } from "@/lib/access";

// Établir la valeur initiale d'un indicateur (après audit / état des lieux). L'historique est conservé :
//  - valider = true  → la valeur devient la valeur initiale de référence (la précédente passe à « remplacé ») ;
//  - valider = false → valeur seulement proposée (résultats d'audit en attente de validation), la valeur initiale
//    en vigueur ne change pas et aucune progression n'est calculée.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const ind = await prisma.goalIndicator.findUnique({ where: { id: params.id }, include: { strategicGoalCycle: { select: { id: true, strategicGoal: { select: { libelle: true } } } } } });
  if (!ind) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });

  const body = await req.json();
  const __g = await guardRecord("goalIndicator", params.id, "modifier");
  if (!__g.ok) return __g.response;

  const valeur = toNumberOrNull(body.valeur);
  if (valeur === null || Number.isNaN(valeur)) return NextResponse.json({ error: "Une valeur numérique est requise (0 est une valeur valide)." }, { status: 400 });
  const date = body.dateMesure ? new Date(body.dateMesure) : new Date();
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Date de mesure invalide." }, { status: 400 });
  const valider = body.valider !== false;

  const baseline = await prisma.$transaction(async (tx) => {
    const created = await tx.goalIndicatorBaseline.create({
      data: {
        goalIndicatorId: ind.id,
        valeur,
        dateMesure: date,
        source: body.source ? String(body.source) : null,
        justificatif: body.justificatif ? String(body.justificatif) : null,
        statut: valider ? "valide" : "propose",
        auteur: user.name,
        validePar: valider ? user.name : null,
        valideLe: valider ? new Date() : null,
      },
    });
    if (valider) {
      await tx.goalIndicatorBaseline.updateMany({ where: { goalIndicatorId: ind.id, statut: "valide", id: { not: created.id } }, data: { statut: "remplace" } });
      await tx.goalIndicator.update({ where: { id: ind.id }, data: { valeurInitiale: valeur } });
    }
    return created;
  });
  await logAudit({
    entityType: "objectif",
    entityId: ind.strategicGoalCycleId,
    entityLabel: ind.strategicGoalCycle.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: { [`${ind.nom}.valeur_initiale`]: { from: ind.valeurInitiale, to: `${valeur}${valider ? "" : " (proposée, à valider)"}` } },
    user,
  });
  return NextResponse.json(baseline, { status: 201 });
}
