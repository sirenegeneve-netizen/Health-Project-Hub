import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("installedProduct", params.id, "supprimer");
  if (!__g.ok) return __g.response;


  await prisma.installedProduct.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
