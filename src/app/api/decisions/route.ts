import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { resolveActorName } from "@/lib/actorResolve";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const decision = await prisma.decision.create({
    data: {
      initiativeId: body.initiativeId,
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
  await logTimelineEvent(body.initiativeId, "decision", `Décision ouverte : « ${decision.subject} »`);
  return NextResponse.json(decision, { status: 201 });
}
