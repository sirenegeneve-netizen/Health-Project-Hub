import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const requirement = await prisma.requirement.create({
    data: {
      projectId: body.projectId,
      titre: body.titre,
      description: body.description || null,
      origine: body.origine || null,
      priorite: body.priorite || "normale",
    },
  });
  await logTimelineEvent(body.projectId, "besoin", `Besoin exprimé : « ${requirement.titre} »`);
  return NextResponse.json(requirement, { status: 201 });
}
