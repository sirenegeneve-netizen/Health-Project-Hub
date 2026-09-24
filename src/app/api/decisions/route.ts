import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { resolveActorName } from "@/lib/actorResolve";
import { requireUser } from "@/lib/auth";
import { logAudit, truncateLabel } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();

  const ownerType = body.ownerType || "initiative"; // groupe | etablissement | initiative
  const ownerId = body.ownerId || body.initiativeId;
  const initiativeId = ownerType === "initiative" ? body.initiativeId : null;
  if (!ownerId) return NextResponse.json({ error: "Portée (ownerId) requise." }, { status: 400 });

  const decision = await prisma.decision.create({
    data: {
      initiativeId,
      ownerType,
      ownerId,
      meetingId: body.meetingId || null,
      subject: body.subject,
      context: body.context || null,
      options: body.options || null,
      recommendation: body.recommendation || null,
      decideurActorId: body.decideurActorId || null,
      decideur: await resolveActorName(body.decideurActorId),
      decision: body.decision || null,
      date: body.date ? new Date(body.date) : null,
      impact: body.impact || null,
      status: body.status || "en_attente",
    },
  });
  if (initiativeId) {
    await logTimelineEvent(initiativeId, "decision", `Décision ouverte : « ${decision.subject} »`);
  }
  await logAudit({ entityType: "decision", entityId: decision.id, entityLabel: truncateLabel(decision.subject), action: "create", user });
  return NextResponse.json(decision, { status: 201 });
}
