import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { loadEditableTemplate } from "@/lib/templateGuard";
import { logAudit } from "@/lib/audit";
import { slugifyKey, uniqueKey } from "@/lib/templatePlan";
import { STAGE_LIBRARY } from "@/lib/templateSeedData";

// Ajoute une étape au parcours : depuis la bibliothèque (stageDefKey) ou une étape libre (label).
// Elle est insérée avant la Clôture si le parcours en contient une, sinon à la fin.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;
  const editable = await loadEditableTemplate(params.id);
  if (!editable.ok) return editable.response;

  const body = await req.json();
  const stages = await prisma.templateStage.findMany({ where: { templateId: params.id }, orderBy: { position: "asc" } });
  const keys = new Set(stages.map((s) => s.key));

  let label: string;
  let objectif: string | null = null;
  let stageDefKey: string | null = null;
  let criteria: string[] = [];
  let legacyPhases: string[] = [];
  if (body.stageDefKey) {
    const def = await prisma.stageDefinition.findUnique({ where: { key: String(body.stageDefKey) } });
    if (!def) return NextResponse.json({ error: "Étape de bibliothèque introuvable." }, { status: 404 });
    label = def.label;
    objectif = def.objectif;
    stageDefKey = def.key;
    criteria = STAGE_LIBRARY[def.key]?.criteria ?? [];
    legacyPhases = STAGE_LIBRARY[def.key]?.legacyPhases ?? [];
  } else {
    label = String(body.label || "").trim();
    if (!label) return NextResponse.json({ error: "Choisissez une étape de la bibliothèque ou saisissez un nom." }, { status: 400 });
  }

  const key = uniqueKey(stageDefKey ?? slugifyKey(label), keys);
  const clotureIdx = stages.findIndex((s) => s.key === "cloture");
  const position = clotureIdx >= 0 ? clotureIdx : stages.length;

  const created = await prisma.$transaction(async (tx) => {
    // Décale les étapes suivantes pour libérer la position.
    await tx.templateStage.updateMany({ where: { templateId: params.id, position: { gte: position } }, data: { position: { increment: 1 } } });
    return tx.templateStage.create({
      data: {
        templateId: params.id,
        position,
        key,
        label,
        stageDefKey,
        objectif,
        obligatoire: body.obligatoire !== false,
        active: true,
        legacyPhases,
        criteria: { create: criteria.map((c, order) => ({ label: c, order })) },
      },
    });
  });
  await logAudit({ entityType: "project_template", entityId: params.id, entityLabel: editable.template.name, action: "update", changes: { etape_ajoutee: { from: null, to: label } }, user: guard.user });
  return NextResponse.json(created, { status: 201 });
}
