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
    await logTimelineEvent(change.projectId, "changement", `Changement accepté : « ${change.titre} »`);

    // §15 : un changement accepté peut entraîner une nouvelle baseline planning,
    // sans jamais écraser l'historique initial.
    if (change.nouvelleDateCible) {
      const project = await prisma.project.findUniqueOrThrow({ where: { id: change.projectId } });
      await prisma.planningBaseline.create({
        data: {
          projectId: change.projectId,
          label: `Changement accepté — ${change.titre}`,
          targetDate: change.nouvelleDateCible,
          reason: change.justification || undefined,
        },
      });
      await prisma.project.update({ where: { id: change.projectId }, data: { targetDate: change.nouvelleDateCible } });
      await logTimelineEvent(
        change.projectId,
        "planning",
        `Date cible révisée suite au changement « ${change.titre} » : ${project.targetDate ? project.targetDate.toLocaleDateString("fr-FR") : "—"} → ${change.nouvelleDateCible.toLocaleDateString("fr-FR")}`
      );
    }
  } else if (body.decision === "rejete" && before.decision !== "rejete") {
    await logTimelineEvent(change.projectId, "changement", `Changement rejeté : « ${change.titre} »`);
  }

  return NextResponse.json(change);
}
