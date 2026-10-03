import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";

// Modification / désactivation / archivage. Un type n'est JAMAIS supprimé physiquement
// (il peut être utilisé par des initiatives) : pas de DELETE.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const current = await prisma.projectType.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Type introuvable." }, { status: 404 });

  const body = await req.json();
  const data: { label?: string; family?: string; description?: string | null; actif?: boolean; archive?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Le libellé ne peut pas être vide." }, { status: 400 });
    data.label = body.label.trim();
  }
  if (typeof body.family === "string" && body.family.trim()) data.family = body.family.trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (typeof body.actif === "boolean") data.actif = body.actif;
  if (typeof body.archive === "boolean") {
    data.archive = body.archive;
    if (body.archive) data.actif = false;
  }

  const updated = await prisma.projectType.update({ where: { id: params.id }, data });
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) {
    if (data[k] !== (current as Record<string, unknown>)[k]) changes[k] = { from: (current as Record<string, unknown>)[k], to: data[k] };
  }
  await logAudit({ entityType: "project_type", entityId: updated.id, entityLabel: updated.label, action: "update", changes, user: guard.user });
  return NextResponse.json(updated);
}
