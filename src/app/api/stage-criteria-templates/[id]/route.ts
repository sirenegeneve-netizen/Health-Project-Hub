import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireConfigAccess } from "@/lib/projectConfigAuth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __cfg = await requireConfigAccess();
  if (__cfg.error) return __cfg.error;

  await prisma.stageCriterionTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
