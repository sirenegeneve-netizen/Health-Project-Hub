import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";

// Ajoute un critère de passage à une étape du modèle.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const stage = await prisma.templateStage.findUnique({ where: { id: params.id }, select: { id: true, label: true, templateId: true } });
  if (!stage) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });
  const editable = await loadEditableTemplate(stage.templateId);
  if (!editable.ok) return editable.response;

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Le libellé du critère est requis." }, { status: 400 });
  const count = await prisma.templateStageCriterion.count({ where: { templateStageId: stage.id } });
  const created = await prisma.templateStageCriterion.create({
    data: { templateStageId: stage.id, label, order: count, obligatoire: body.obligatoire !== false },
  });
  await logAudit({ entityType: "project_template", entityId: stage.templateId, entityLabel: editable.template.name, action: "update", changes: { [`${stage.label}.critere_ajoute`]: { from: null, to: label } }, user: guard.user });
  return NextResponse.json(created, { status: 201 });
}
