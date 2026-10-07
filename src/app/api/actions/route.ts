import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, truncateLabel } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();

  let responsableName: string | null = null;
  if (body.responsableActorId) {
    const actor = await prisma.actor.findUnique({ where: { id: body.responsableActorId } });
    responsableName = actor?.name || null;
  }

  const ownerType = body.ownerType || "initiative"; // groupe | etablissement | initiative
  const ownerId = body.ownerId || body.initiativeId;
  const initiativeId = ownerType === "initiative" ? body.initiativeId : null;
  if (!ownerId) return NextResponse.json({ error: "Portée (ownerId) requise." }, { status: 400 });

  // Plan d'action : l'objectif lié doit appartenir au même groupe / établissement que l'action.
  let strategicGoalCycleId: string | null = null;
  if (body.strategicGoalCycleId) {
    const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: body.strategicGoalCycleId }, include: { strategicGoal: true } });
    if (!cycle) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
    if (cycle.strategicGoal.ownerType !== ownerType || cycle.strategicGoal.ownerId !== ownerId) {
      return NextResponse.json({ error: "L'objectif doit appartenir au même groupe ou établissement que l'action." }, { status: 400 });
    }
    strategicGoalCycleId = cycle.id;
  }

  const action = await prisma.action.create({
    data: {
      strategicGoalCycleId,
      livrable: body.livrable ? String(body.livrable) : null,
      initiativeId,
      ownerType,
      ownerId,
      meetingId: body.meetingId || null,
      riskId: body.riskId || null,
      decisionId: body.decisionId || null,
      auditFindingId: body.auditFindingId || null,
      establishmentId: body.establishmentId || null,
      title: body.title,
      responsableActorId: body.responsableActorId || null,
      responsable: responsableName,
      dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
      echeance: body.echeance ? new Date(body.echeance) : null,
      priority: body.priority || "normale",
      origine: body.origine || "manuel",
      comments: body.comments || null,
    },
  });
  if (initiativeId) {
    await logTimelineEvent(initiativeId, "action", `Action créée : « ${action.title} »`);
  }
  await logAudit({ entityType: "action", entityId: action.id, entityLabel: truncateLabel(action.title), action: "create", user });
  return NextResponse.json(action, { status: 201 });
}
