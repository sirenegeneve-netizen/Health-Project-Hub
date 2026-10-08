import { handleDelete } from "@/lib/deletion";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords, truncateLabel } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const before = await prisma.action.findUniqueOrThrow({ where: { id: params.id } });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.responsable !== undefined) data.responsable = body.responsable;
  if (body.dateDebut !== undefined) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null;
  if (body.echeance !== undefined) {
    // Report d'échéance : on trace le nombre de reports (§19).
    if (body.echeance && before.echeance && new Date(body.echeance).getTime() !== before.echeance.getTime()) {
      data.postponedCount = before.postponedCount + 1;
    }
    data.echeance = body.echeance ? new Date(body.echeance) : null;
  }
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.status !== undefined) data.status = body.status;
  if (body.comments !== undefined) data.comments = body.comments;
  if (body.livrable !== undefined) data.livrable = body.livrable ? String(body.livrable) : null;

  // Rattachement à un objectif (« action à rattacher » du plan d'action), à un indicateur, à une exigence.
  // L'objectif doit appartenir au même groupe / établissement que l'action ; l'indicateur à cet objectif.
  let targetCycleId: string | null | undefined = body.strategicGoalCycleId === undefined ? undefined : body.strategicGoalCycleId || null;
  if (targetCycleId) {
    const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: targetCycleId }, include: { strategicGoal: true } });
    if (!cycle) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
    if (cycle.strategicGoal.ownerType !== before.ownerType || cycle.strategicGoal.ownerId !== before.ownerId) {
      return NextResponse.json({ error: "L'objectif doit appartenir au même groupe ou établissement que l'action." }, { status: 400 });
    }
  }
  if (targetCycleId !== undefined) {
    data.strategicGoalCycleId = targetCycleId;
    // Changer d'objectif détache l'indicateur associé (il appartenait à l'ancien objectif).
    if (targetCycleId !== before.strategicGoalCycleId && body.indicatorId === undefined) data.indicatorId = null;
  }
  if (body.indicatorId !== undefined) {
    if (body.indicatorId) {
      const effectiveCycle = targetCycleId !== undefined ? targetCycleId : before.strategicGoalCycleId;
      const ind = await prisma.goalIndicator.findUnique({ where: { id: body.indicatorId }, select: { strategicGoalCycleId: true } });
      if (!ind) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });
      if (!effectiveCycle || ind.strategicGoalCycleId !== effectiveCycle) {
        return NextResponse.json({ error: "L'indicateur associé doit appartenir à l'objectif de l'action." }, { status: 400 });
      }
    }
    data.indicatorId = body.indicatorId || null;
  }
  if (body.qualityRequirementId !== undefined) {
    if (body.qualityRequirementId) {
      const req = await prisma.qualityRequirement.findUnique({ where: { id: body.qualityRequirementId }, select: { id: true } });
      if (!req) return NextResponse.json({ error: "Exigence introuvable." }, { status: 404 });
    }
    data.qualityRequirementId = body.qualityRequirementId || null;
  }

  const action = await prisma.action.update({ where: { id: params.id }, data });

  if (body.status && body.status !== before.status && action.initiativeId) {
    await logTimelineEvent(action.initiativeId, "action", `Action « ${action.title} » → ${body.status}`);
  }
  await logAudit({ entityType: "action", entityId: action.id, entityLabel: truncateLabel(action.title), action: "update", changes: diffRecords(before, action), user });
  return NextResponse.json(action);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleDelete("action", params.id);
}
