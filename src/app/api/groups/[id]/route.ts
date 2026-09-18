import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const group = await prisma.group.update({
    where: { id: params.id },
    data: { name: body.name ? String(body.name).trim() : undefined },
  });
  return NextResponse.json(group);
}
