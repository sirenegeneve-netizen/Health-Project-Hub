import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  await prisma.problem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
