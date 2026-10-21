import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("incident", body);
  if (!__g.ok) return __g.response;

  const incident = await prisma.incident.create({
    data: {
      initiativeId: body.initiativeId,
      establishmentId: body.establishmentId || null,
      titre: body.titre,
      description: body.description || null,
      gravite: body.gravite || "mineure",
      status: body.status || "ouvert",
      problemId: body.problemId || null,
      declarantActorId: body.declarantActorId || null,
    },
  });
  return NextResponse.json(incident, { status: 201 });
}
