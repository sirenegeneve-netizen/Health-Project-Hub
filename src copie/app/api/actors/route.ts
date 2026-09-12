import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const actor = await prisma.actor.create({
    data: {
      initiativeId: body.initiativeId || null,
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
  // Contact direct d'un Groupe ou d'un Établissement (architecture Groupe >
  // Établissement > Initiative) : créé en même temps que l'acteur si fourni.
  if (body.affiliation && (body.affiliation.groupId || body.affiliation.establishmentId)) {
    await prisma.actorAffiliation.create({
      data: {
        actorId: actor.id,
        groupId: body.affiliation.groupId || null,
        establishmentId: body.affiliation.establishmentId || null,
        role: body.affiliation.role || null,
      },
    });
  }
  if (body.initiativeId) {
    await logTimelineEvent(body.initiativeId, "acteur", `Acteur ajouté à l'équipe projet : « ${actor.name} »`);
  }
  return NextResponse.json(actor, { status: 201 });
}
