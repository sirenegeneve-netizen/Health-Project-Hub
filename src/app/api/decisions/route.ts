import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const decision = await prisma.decision.create({
    data: {
      projectId: body.projectId,
      meetingId: body.meetingId || null,
      subject: body.subject,
      context: body.context || null,
      options: body.options || null,
      recommendation: body.recommendation || null,
      decideur: body.decideur || null,
      decision: body.decision || null,
      date: body.date ? new Date(body.date) : null,
      impact: body.impact || null,
      status: body.status || "en_attente",
    },
  });
  await logTimelineEvent(body.projectId, "decision", `Décision ouverte : « ${decision.subject} »`);
  return NextResponse.json(decision, { status: 201 });
}
