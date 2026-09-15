import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  let groupId = body.groupId as string | undefined;
  if (!groupId) {
    const firstGroup = await prisma.group.findFirst();
    groupId = firstGroup ? firstGroup.id : (await prisma.group.create({ data: { name: "Groupe par défaut" } })).id;
  }
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
