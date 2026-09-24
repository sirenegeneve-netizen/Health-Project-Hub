import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, truncateLabel } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();

  let proprietaireName: string | null = null;
  if (body.proprietaireActorId) {
    const actor = await prisma.actor.findUnique({ where: { id: body.proprietaireActorId } });
    proprietaireName = actor?.name || null;
  }

  const ownerType = body.ownerType || "initiative"; // groupe | etablissement | initiative
  const ownerId = body.ownerId || body.initiativeId;
  const initiativeId = ownerType === "initiative" ? body.initiativeId : null;
  if (!ownerId) return NextResponse.json({ error: "Portée (ownerId) requise." }, { status: 400 });

  const risk = await prisma.risk.create({
    data: {
      initiativeId,
      ownerType,
      ownerId,
      meetingId: body.meetingId || null,
      interfaceId: body.interfaceId || null,
      establishmentId: body.establishmentId || null,
      description: body.description,
      cause: body.cause || null,
      consequence: body.consequence || null,
      probabilite: body.probabilite || "moyenne",
      impact: body.impact || "moyen",
      criticite: body.criticite || "moyenne",
      proprietaireActorId: body.proprietaireActorId || null,
      proprietaire: proprietaireName,
      planAction: body.planAction || null,
      echeance: body.echeance ? new Date(body.echeance) : null,
    },
  });
  if (initiativeId) {
    await logTimelineEvent(initiativeId, "risque", `Risque identifié : « ${risk.description} »`);
  }
  await logAudit({ entityType: "risk", entityId: risk.id, entityLabel: truncateLabel(risk.description), action: "create", user });
  return NextResponse.json(risk, { status: 201 });
}
