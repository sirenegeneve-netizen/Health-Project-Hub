import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const before = await prisma.group.findUnique({ where: { id: params.id } });
  const body = await req.json();
  const group = await prisma.group.update({
    where: { id: params.id },
    data: { name: body.name ? String(body.name).trim() : undefined },
  });
  if (before) {
    await logAudit({ entityType: "group", entityId: group.id, entityLabel: group.name, action: "update", changes: diffRecords(before, group), user });
  }
  return NextResponse.json(group);
}
