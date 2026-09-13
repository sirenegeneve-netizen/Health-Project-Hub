import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
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
