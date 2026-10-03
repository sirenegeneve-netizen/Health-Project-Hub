import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";

// Modifier la bibliothèque n'altère ni les modèles existants ni les initiatives : ils portent leur propre copie.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const current = await prisma.stageDefinition.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Étape introuvable." }, { status: 404 });

  const body = await req.json();
  const data: { label?: string; description?: string | null; objectif?: string | null; actif?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Le libellé ne peut pas être vide." }, { status: 400 });
    data.label = body.label.trim();
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.objectif !== undefined) data.objectif = body.objectif ? String(body.objectif) : null;
  if (typeof body.actif === "boolean") data.actif = body.actif;

  const updated = await prisma.stageDefinition.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) {
    if (data[k] !== (current as Record<string, unknown>)[k]) changes[k] = { from: (current as Record<string, unknown>)[k], to: data[k] };
  }
  await logAudit({ entityType: "stage_definition", entityId: updated.id, entityLabel: updated.label, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}
