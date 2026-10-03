import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";
import { moveInOrder, uniqueKey } from "@/lib/templatePlan";

async function loadStage(id: string) {
  return prisma.templateStage.findUnique({ where: { id }, include: { criteria: true, items: true } });
}

// Modifier une étape du modèle : libellé, objectif, obligatoire/optionnelle, active, déplacement.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const stage = await loadStage(params.id);
  if (!stage) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(stage.templateId);
  if (!editable.ok) return editable.response;

  const body = await req.json();

  if (body.move === "up" || body.move === "down") {
    const siblings = await prisma.templateStage.findMany({ where: { templateId: stage.templateId }, orderBy: { position: "asc" }, select: { id: true } });
    const next = moveInOrder(siblings.map((s) => s.id), stage.id, body.move);
    if (!next) return NextResponse.json({ ok: true, moved: false });
    await prisma.$transaction(next.map((id, position) => prisma.templateStage.update({ where: { id }, data: { position } })));
    await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes: { etape_deplacee: { from: stage.label, to: body.move } }, user: guard.user });
    return NextResponse.json({ ok: true, moved: true });
  }

  const data: { label?: string; objectif?: string | null; description?: string | null; obligatoire?: boolean; active?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Le nom de l'étape ne peut pas être vide." }, { status: 400 });
    data.label = body.label.trim();
  }
  if (body.objectif !== undefined) data.objectif = body.objectif ? String(body.objectif) : null;
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (typeof body.obligatoire === "boolean") data.obligatoire = body.obligatoire;
  if (typeof body.active === "boolean") data.active = body.active;

  const updated = await prisma.templateStage.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) if (data[k] !== stage[k]) changes[`${stage.label}.${k}`] = { from: stage[k], to: data[k] };
  await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}

// Dupliquer une étape (juste après l'originale), avec ses critères.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const stage = await loadStage(params.id);
  if (!stage) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(stage.templateId);
  if (!editable.ok) return editable.response;

  const siblings = await prisma.templateStage.findMany({ where: { templateId: stage.templateId }, select: { key: true } });
  const key = uniqueKey(stage.key, new Set(siblings.map((s) => s.key)));
  const created = await prisma.$transaction(async (tx) => {
    await tx.templateStage.updateMany({ where: { templateId: stage.templateId, position: { gt: stage.position } }, data: { position: { increment: 1 } } });
    return tx.templateStage.create({
      data: {
        templateId: stage.templateId,
        position: stage.position + 1,
        key,
        label: `${stage.label} (copie)`,
        stageDefKey: stage.stageDefKey,
        description: stage.description,
        objectif: stage.objectif,
        obligatoire: stage.obligatoire,
        active: stage.active,
        legacyPhases: [],
        criteria: { create: stage.criteria.map((c) => ({ label: c.label, order: c.order, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })) },
        items: { create: stage.items.map((it) => ({ kind: it.kind, label: it.label, order: it.order, obligatoire: it.obligatoire })) },
      },
    });
  });
  await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes: { etape_dupliquee: { from: null, to: stage.label } }, user: guard.user });
  return NextResponse.json(created, { status: 201 });
}

// Retirer l'étape du parcours du modèle (n'affecte aucune initiative : elles portent leur propre copie).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const stage = await loadStage(params.id);
  if (!stage) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(stage.templateId);
  if (!editable.ok) return editable.response;

  await prisma.$transaction(async (tx) => {
    await tx.templateStage.delete({ where: { id: stage.id } });
    await tx.templateStage.updateMany({ where: { templateId: stage.templateId, position: { gt: stage.position } }, data: { position: { decrement: 1 } } });
  });
  await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes: { etape_retiree: { from: stage.label, to: null } }, user: guard.user });
  return NextResponse.json({ ok: true });
}
