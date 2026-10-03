import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";
import { cloneTemplate } from "@/lib/templateEngine";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const typeKey = new URL(req.url).searchParams.get("typeKey");
  const templates = await prisma.projectTemplate.findMany({
    where: typeKey ? { typeKey } : {},
    include: { _count: { select: { stages: true, initiatives: true } } },
    orderBy: [{ typeKey: "asc" }, { name: "asc" }, { version: "desc" }],
  });
  return NextResponse.json(templates);
}

// Créer un modèle : partir de zéro, ou dupliquer un modèle existant (autre type possible).
export async function POST(req: NextRequest) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const body = await req.json();
  const name = String(body.name || "").trim();
  const typeKey = String(body.typeKey || "").trim();
  if (!name || !typeKey) return NextResponse.json({ error: "Le nom et le type sont requis." }, { status: 400 });
  const type = await prisma.projectType.findUnique({ where: { key: typeKey } });
  if (!type) return NextResponse.json({ error: "Type de projet introuvable." }, { status: 404 });

  let created;
  if (body.sourceId) {
    created = await cloneTemplate(prisma, String(body.sourceId), { mode: "duplicate", name, typeKey });
    if (!created) return NextResponse.json({ error: "Modèle source introuvable." }, { status: 404 });
  } else {
    created = await prisma.projectTemplate.create({
      data: { typeKey, name, familyId: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, version: 1, status: "brouillon" },
    });
  }
  await logAudit({ entityType: "project_template", entityId: created.id, entityLabel: `${created.name} — V${created.version}`, action: "create", user: guard.user });
  return NextResponse.json(created, { status: 201 });
}
