import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const affiliation = await prisma.actorAffiliation.create({
    data: {
      actorId: body.actorId,
      groupId: body.groupId || null,
      establishmentId: body.establishmentId || null,
      role: body.role || null,
    },
  });
  return NextResponse.json(affiliation, { status: 201 });
}
