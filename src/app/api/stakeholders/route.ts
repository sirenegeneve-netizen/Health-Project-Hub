import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stakeholder = await prisma.stakeholder.create({
    data: {
      initiativeId: body.initiativeId,
      name: body.name,
      organisation: body.organisation || null,
      role: body.role || null,
      implication: body.implication || null,
      influence: body.influence || null,
      contact: body.contact || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "partie_prenante", `Partie prenante ajoutée : « ${stakeholder.name} »`);
  return NextResponse.json(stakeholder, { status: 201 });
}
