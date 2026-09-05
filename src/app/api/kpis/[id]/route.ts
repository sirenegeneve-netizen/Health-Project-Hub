import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  await prisma.kpi.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
