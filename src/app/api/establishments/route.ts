import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const groupId = body.groupId as string | undefined;
  if (!groupId) {
    return NextResponse.json({ error: "groupId est requis — un établissement doit être rattaché à un groupe explicitement choisi." }, { status: 400 });
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });

  const establishment = await prisma.establishment.create({
    data: {
      name: body.name,
      groupId,
      type: body.type || null,
      localisation: body.localisation || null,
    },
  });
  return NextResponse.json(establishment, { status: 201 });
}

export async function GET() {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const establishments = await prisma.establishment.findMany({
    include: { initiatives: { include: { initiative: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(establishments);
}
