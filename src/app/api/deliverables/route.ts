import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { resolveActorName } from "@/lib/actorResolve";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const item = await prisma.deliverable.create({
    data: {
      initiativeId: body.initiativeId,
      name: body.name,
      description: body.description || null,
      responsableActorId: body.responsableActorId || null,
      responsable: await resolveActorName(body.responsableActorId),
      datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
      version: body.version || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "livrable", `Livrable ajouté : « ${item.name} »`);
  return NextResponse.json(item, { status: 201 });
}
