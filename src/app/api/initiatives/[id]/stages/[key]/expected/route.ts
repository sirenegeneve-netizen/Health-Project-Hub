import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createExpectedObject, getStageState } from "@/lib/stageRuntime";
import { isItemKind, TRACKED_KINDS } from "@/lib/templatePlan";

// Crée l'objet HPH réel (livrable, action, décision, risque, indicateur) correspondant à un élément
// attendu de l'étape, rattaché à cette étape. Refuse si l'élément existe déjà (pas de doublon).
export async function POST(req: NextRequest, { params }: { params: { id: string; key: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const kind = body.kind;
  const label = String(body.label || "").trim();
  if (!isItemKind(kind) || !TRACKED_KINDS.includes(kind) || !label) {
    return NextResponse.json({ error: "Élément invalide." }, { status: 400 });
  }

  const state = await getStageState(params.id, params.key);
  if (!state) return NextResponse.json({ error: "Étape introuvable pour cette initiative." }, { status: 404 });
  const item = state.expected.find((e) => e.kind === kind && e.label === label);
  if (!item) return NextResponse.json({ error: "Cet élément n'est pas attendu à cette étape." }, { status: 400 });
  if (item.state !== "missing") return NextResponse.json({ error: "Cet élément existe déjà pour cette étape." }, { status: 409 });

  const created = await createExpectedObject(params.id, state.stage, kind, label, { value: body.value === undefined ? undefined : Number(body.value) });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });

  const initiative = await prisma.initiative.findUnique({ where: { id: params.id }, select: { name: true } });
  await logAudit({ entityType: "initiative", entityId: params.id, entityLabel: initiative?.name || params.id, action: "update", changes: { [`${state.stage.label}.${kind}_cree`]: { from: null, to: label } }, user });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
