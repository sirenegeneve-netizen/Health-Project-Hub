import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entry = await prisma.raciEntry.create({
    data: {
      projectId: body.projectId,
      actorId: body.actorId,
      activite: body.activite,
      role: body.role,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
