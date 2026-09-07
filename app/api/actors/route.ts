import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const actor = await prisma.actor.create({
    data: {
      projectId: body.projectId,
      name: body.name,
      fonction: body.fonction || null,
      organisation: body.organisation || null,
      roleProjet: body.roleProjet || null,
      email: body.email || null,
      telephone: body.telephone || null,
      disponibiliteJh: body.disponibiliteJh ? Number(body.disponibiliteJh) : null,
      competences: body.competences || null,
    },
  });
  await logTimelineEvent(body.projectId, "acteur", `Acteur ajouté à l'équipe projet : « ${actor.name} »`);
  return NextResponse.json(actor, { status: 201 });
}
