import { handleDelete } from "@/lib/deletion";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("kpi", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

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
  const __g = await guardRecord("kpi", params.id, "supprimer");
  if (!__g.ok) return __g.response;

  return handleDelete("kpi", params.id);
}
