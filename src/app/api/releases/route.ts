import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const release = await prisma.release.create({
    data: {
      initiativeId: body.initiativeId,
      version: body.version,
      dateDeploiement: body.dateDeploiement ? new Date(body.dateDeploiement) : null,
      contenu: body.contenu || null,
      status: body.status || "planifiee",
    },
  });
  return NextResponse.json(release, { status: 201 });
}
