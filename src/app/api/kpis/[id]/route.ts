import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const kpi = await prisma.kpi.update({
    where: { id: params.id },
    data: {
      value: body.value !== undefined ? Number(body.value) : undefined,
      target: body.target !== undefined ? Number(body.target) : undefined,
    },
  });
  return NextResponse.json(kpi);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.kpi.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
