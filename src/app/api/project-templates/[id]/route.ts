import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";
import { activateTemplate, cloneTemplate } from "@/lib/templateEngine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const template = await prisma.projectTemplate.findUnique({
    where: { id: params.id },
    include: { stages: { include: { criteria: { orderBy: { order: "asc" } } }, orderBy: { position: "asc" } }, _count: { select: { initiatives: true } } },
  });
  if (!template) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  return NextResponse.json(template);
}

// Renommer, activer, archiver, ou créer une nouvelle version.
// Le nom et la description peuvent toujours être corrigés ; le contenu du parcours est
// protégé par loadEditableTemplate (routes des étapes et des critères).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const current = await prisma.projectTemplate.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  const body = await req.json();
  const label = `${current.name} — V${current.version}`;

  if (body.action === "new_version") {
    const created = await cloneTemplate(prisma, params.id, { mode: "new_version" });
    if (!created) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    await logAudit({ entityType: "project_template", entityId: created.id, entityLabel: `${created.name} — V${created.version}`, action: "create", user: guard.user });
    return NextResponse.json(created, { status: 201 });
  }
  if (body.action === "activate") {
    const res = await activateTemplate(prisma, params.id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    await logAudit({ entityType: "project_template", entityId: current.id, entityLabel: label, action: "update", changes: { status: { from: current.status, to: "actif" } }, user: guard.user });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "archive") {
    if (current.isGeneral) return NextResponse.json({ error: "Le Modèle général ne peut pas être archivé." }, { status: 400 });
    await prisma.projectTemplate.update({ where: { id: params.id }, data: { status: "archive" } });
    await logAudit({ entityType: "project_template", entityId: current.id, entityLabel: label, action: "update", changes: { status: { from: current.status, to: "archive" } }, user: guard.user });
    return NextResponse.json({ ok: true });
  }

  const data: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  const updated = await prisma.projectTemplate.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) if (data[k] !== current[k]) changes[k] = { from: current[k], to: data[k] };
  await logAudit({ entityType: "project_template", entityId: updated.id, entityLabel: label, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}
