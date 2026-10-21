import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("trainingRecord", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

  const training = await prisma.trainingRecord.update({
    where: { id: params.id },
    data: {
      nbUsers: body.nbUsers !== undefined ? Number(body.nbUsers) : undefined,
      nbFormes: body.nbFormes !== undefined ? Number(body.nbFormes) : undefined,
      autonomyLevel: body.autonomyLevel !== undefined ? Number(body.autonomyLevel) : undefined,
      referent: body.referent ?? undefined,
      referentContact: body.referentContact ?? undefined,
    },
  });
  return NextResponse.json(training);
}
