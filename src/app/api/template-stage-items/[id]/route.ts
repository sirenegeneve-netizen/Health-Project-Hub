import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";

async function loadItem(id: string) {
  return prisma.templateStageItem.findUnique({ where: { id }, include: { templateStage: { select: { label: true, templateId: true } } } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const item = await loadItem(params.id);
  if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(item.templateStage.templateId);
  if (!editable.ok) return editable.response;

  const body = await req.json();
  const data: { label?: string; obligatoire?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Le libellé ne peut pas être vide." }, { status: 400 });
    data.label = body.label.trim();
  }
  if (typeof body.obligatoire === "boolean") data.obligatoire = body.obligatoire;
  const updated = await prisma.templateStageItem.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) if (data[k] !== item[k]) changes[`${item.templateStage.label}.${item.kind}.${k}`] = { from: item[k], to: data[k] };
  await logAudit({ entityType: "project_template", entityId: item.templateStage.templateId, entityLabel: editable.template.name, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const item = await loadItem(params.id);
  if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(item.templateStage.templateId);
  if (!editable.ok) return editable.response;

  await prisma.templateStageItem.delete({ where: { id: params.id } });
  await logAudit({ entityType: "project_template", entityId: item.templateStage.templateId, entityLabel: editable.template.name, action: "update", changes: { [`${item.templateStage.label}.${item.kind}_retire`]: { from: item.label, to: null } }, user: guard.user });
  return NextResponse.json({ ok: true });
}
