import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { resolveActorName } from "@/lib/actorResolve";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const iface = await prisma.interface.create({
    data: {
      projectId: body.projectId,
      name: body.name,
      systemeSource: body.systemeSource || null,
      systemeCible: body.systemeCible || null,
      flux: body.flux || null,
      protocole: body.protocole || null,
      standard: body.standard || null,
      responsableActorId: body.responsableActorId || null,
      responsable: await resolveActorName(body.responsableActorId),
      fournisseur: body.fournisseur || null,
      datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
      isBlocking: !!body.isBlocking,
    },
  });
  await logTimelineEvent(body.projectId, "interface", `Interface ajoutée : « ${iface.name} »`);
  return NextResponse.json(iface, { status: 201 });
}
