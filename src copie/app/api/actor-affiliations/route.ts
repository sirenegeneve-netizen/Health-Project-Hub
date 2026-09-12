import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
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
