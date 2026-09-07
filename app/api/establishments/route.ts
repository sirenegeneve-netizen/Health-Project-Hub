import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
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
  const establishments = await prisma.establishment.findMany({
    include: { projects: { include: { project: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(establishments);
}
