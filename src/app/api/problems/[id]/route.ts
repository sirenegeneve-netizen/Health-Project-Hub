import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const problem = await prisma.problem.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      causeRacine: body.causeRacine ?? undefined,
    },
  });
  return NextResponse.json(problem);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.problem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
