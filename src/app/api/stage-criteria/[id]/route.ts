import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATUS_VALUES } from "@/lib/stageCriteria";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { status } = body;
  if (!STATUS_VALUES.includes(status)) {
    return NextResponse.json({ error: "statut invalide" }, { status: 400 });
  }
  const updated = await prisma.stageCriterion.update({ where: { id: params.id }, data: { status } });
  return NextResponse.json(updated);
}
