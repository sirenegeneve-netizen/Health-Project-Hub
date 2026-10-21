import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS_VALUES } from "@/lib/stageCriteria";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("stageCriterion", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

  const { status } = body;
  if (!STATUS_VALUES.includes(status)) {
    return NextResponse.json({ error: "statut invalide" }, { status: 400 });
  }
  const updated = await prisma.stageCriterion.update({ where: { id: params.id }, data: { status } });
  return NextResponse.json(updated);
}
