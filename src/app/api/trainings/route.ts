import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("trainingRecord", body);
  if (!__g.ok) return __g.response;

  const training = await prisma.trainingRecord.create({
    data: {
      initiativeId: body.initiativeId,
      establishmentId: body.establishmentId || null,
      service: body.service || null,
      metier: body.metier || null,
      profil: body.profil || null,
      nbUsers: Number(body.nbUsers) || 0,
      nbFormes: Number(body.nbFormes) || 0,
      autonomyLevel: Number(body.autonomyLevel) || 0,
      referent: body.referent || null,
      referentContact: body.referentContact || null,
      dateFormation: body.dateFormation ? new Date(body.dateFormation) : null,
    },
  });
  await logTimelineEvent(body.initiativeId, "formation", `Suivi formation ajouté : ${body.profil || body.metier || "profil"}`);
  return NextResponse.json(training, { status: 201 });
}
