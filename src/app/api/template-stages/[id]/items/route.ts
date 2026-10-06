import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";
import { isItemKind } from "@/lib/templatePlan";

// Ajoute un élément attendu à une étape du modèle : « dans cette étape, pour ce modèle, cet élément est attendu ».
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const stage = await prisma.templateStage.findUnique({ where: { id: params.id }, select: { id: true, label: true, templateId: true } });
  if (!stage) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(stage.templateId);
  if (!editable.ok) return editable.response;

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!isItemKind(body.kind) || !label) return NextResponse.json({ error: "Type et libellé requis." }, { status: 400 });
  const dup = await prisma.templateStageItem.count({ where: { templateStageId: stage.id, kind: body.kind, label } });
  if (dup > 0) return NextResponse.json({ error: "Cet élément existe déjà dans l'étape." }, { status: 409 });
  const count = await prisma.templateStageItem.count({ where: { templateStageId: stage.id } });
  const created = await prisma.templateStageItem.create({
    data: { templateStageId: stage.id, kind: body.kind, label, order: count, obligatoire: body.obligatoire !== false },
  });
  await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes: { [`${stage.label}.${body.kind}_ajoute`]: { from: null, to: label } }, user: guard.user });
  return NextResponse.json(created, { status: 201 });
}
