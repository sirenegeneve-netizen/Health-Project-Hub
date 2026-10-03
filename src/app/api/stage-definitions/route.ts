import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";
import { slugifyKey, uniqueKey } from "@/lib/templatePlan";

export async function GET() {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const defs = await prisma.stageDefinition.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json(defs);
}

// Crée une étape réutilisable dans la bibliothèque.
export async function POST(req: NextRequest) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });
  const keys = new Set((await prisma.stageDefinition.findMany({ select: { key: true } })).map((d) => d.key));
  const created = await prisma.stageDefinition.create({
    data: {
      key: uniqueKey(slugifyKey(label), keys),
      label,
      description: body.description ? String(body.description) : null,
      objectif: body.objectif ? String(body.objectif) : null,
    },
  });
  await logAudit({ entityType: "stage_definition", entityId: created.id, entityLabel: created.label, action: "create", user: guard.user });
  return NextResponse.json(created, { status: 201 });
}
