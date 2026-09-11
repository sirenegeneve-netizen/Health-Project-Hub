import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.changeRequest.findUniqueOrThrow({ where: { id: params.id } });

  const change = await prisma.changeRequest.update({
    where: { id: params.id },
    data: {
      decision: body.decision ?? undefined,
      decideur: body.decideur ?? undefined,
      dateDecision: body.decision && body.decision !== before.decision ? new Date() : undefined,
    },
  });

  if (body.decision === "accepte" && before.decision !== "accepte") {
    await logTimelineEvent(change.initiativeId, "changement", `Changement accepté : « ${change.titre} »`);

    // §15 : un changement accepté peut entraîner une nouvelle baseline planning,
    // sans jamais écraser l'historique initial.
    if (change.nouvelleDateCible) {
      const initiative = await prisma.initiative.findUniqueOrThrow({ where: { id: change.initiativeId } });
      await prisma.planningBaseline.create({
        data: {
          initiativeId: change.initiativeId,
          label: `Changement accepté — ${change.titre}`,
          targetDate: change.nouvelleDateCible,
          reason: change.justification || undefined,
        },
      });
      await prisma.initiative.update({ where: { id: change.initiativeId }, data: { targetDate: change.nouvelleDateCible } });
      await logTimelineEvent(
        change.initiativeId,
        "planning",
        `Date cible révisée suite au changement « ${change.titre} » : ${initiative.targetDate ? initiative.targetDate.toLocaleDateString("fr-FR") : "—"} → ${change.nouvelleDateCible.toLocaleDateString("fr-FR")}`
      );
    }
  } else if (body.decision === "rejete" && before.decision !== "rejete") {
    await logTimelineEvent(change.initiativeId, "changement", `Changement rejeté : « ${change.titre} »`);
  }

  return NextResponse.json(change);
}
