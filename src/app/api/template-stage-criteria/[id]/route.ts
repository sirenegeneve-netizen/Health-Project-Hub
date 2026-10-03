import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";

async function loadCriterion(id: string) {
  return prisma.templateStageCriterion.findUnique({ where: { id }, include: { templateStage: { select: { label: true, templateId: true } } } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const criterion = await loadCriterion(params.id);
  if (!criterion) return NextResponse.json({ error: "Critère introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(criterion.templateStage.templateId);
  if (!editable.ok) return editable.response;

  const body = await req.json();
  const data: { label?: string; obligatoire?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Le libellé ne peut pas être vide." }, { status: 400 });
    data.label = body.label.trim();
  }
  if (typeof body.obligatoire === "boolean") data.obligatoire = body.obligatoire;
  const updated = await prisma.templateStageCriterion.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) if (data[k] !== criterion[k]) changes[`${criterion.templateStage.label}.critere.${k}`] = { from: criterion[k], to: data[k] };
  await logAudit({ entityType: "project_template", entityId: criterion.templateStage.templateId, entityLabel: editable.template.name, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const criterion = await loadCriterion(params.id);
  if (!criterion) return NextResponse.json({ error: "Critère introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(criterion.templateStage.templateId);
  if (!editable.ok) return editable.response;

  await prisma.templateStageCriterion.delete({ where: { id: params.id } });
  await logAudit({ entityType: "project_template", entityId: criterion.templateStage.templateId, entityLabel: editable.template.name, action: "update", changes: { [`${criterion.templateStage.label}.critere_retire`]: { from: criterion.label, to: null } }, user: guard.user });
  return NextResponse.json({ ok: true });
}
