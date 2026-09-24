import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "Le nom du groupe est requis." }, { status: 400 });
  }

  const group = await prisma.group.create({ data: { name: String(body.name).trim() } });
  await logAudit({ entityType: "group", entityId: group.id, entityLabel: group.name, action: "create", user });
  return NextResponse.json(group, { status: 201 });
}
