import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("release", body);
  if (!__g.ok) return __g.response;

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
