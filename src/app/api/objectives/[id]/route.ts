import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { lockedFieldsTouched } from "@/lib/diffusion";
import { propagateGoalToChildren } from "@/lib/diffusionDb";
import { isObjectiveStatut, isPriorite } from "@/lib/objectifs";
import { loadObjectiveDetail } from "@/lib/objectifsDb";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const detail = await loadObjectiveDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
  return NextResponse.json(detail);
}

// Intitulé et description : verrouillés sur une déclinaison d'établissement (ils suivent le groupe).
// Statut, priorité, pilote, axe, résultat attendu, périmètre, échéance : propres à chaque objectif.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: params.id }, include: { strategicGoal: true } });
  if (!cycle) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });

  const locked = lockedFieldsTouched(!!cycle.parentCycleId, body, ["libelle", "description"]);
  if (locked.length > 0) {
    return NextResponse.json({ error: "Cet objectif est hérité du groupe : son intitulé et sa description se modifient depuis le groupe.", code: "inherited_locked", fields: locked }, { status: 403 });
  }
  if (body.statut !== undefined && !isObjectiveStatut(body.statut)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  if (body.priorite !== undefined && !isPriorite(body.priorite)) return NextResponse.json({ error: "Priorité invalide." }, { status: 400 });
  if (body.libelle !== undefined && !String(body.libelle).trim()) return NextResponse.json({ error: "L'intitulé ne peut pas être vide." }, { status: 400 });

  let responsable: string | null | undefined = undefined;
  if (body.responsableActorId !== undefined) {
    const actor = body.responsableActorId ? await prisma.actor.findUnique({ where: { id: body.responsableActorId }, select: { name: true } }) : null;
    responsable = actor?.name || null;
  }
  const echeance = body.echeance === undefined ? undefined : body.echeance ? new Date(body.echeance) : null;
  const text = (v: unknown) => (v === undefined ? undefined : v ? String(v) : null);

  const updated = await prisma.strategicGoalCycle.update({
    where: { id: params.id },
    data: {
      statut: body.statut,
      priorite: body.priorite,
      responsableActorId: body.responsableActorId === undefined ? undefined : body.responsableActorId || null,
      responsable,
      axe: text(body.axe),
      resultatAttendu: text(body.resultatAttendu),
      perimetre: text(body.perimetre),
      echeance,
    },
  });
  if (body.libelle !== undefined || body.description !== undefined) {
    await prisma.strategicGoal.update({
      where: { id: cycle.strategicGoalId },
      data: { libelle: body.libelle === undefined ? undefined : String(body.libelle).trim(), description: text(body.description) },
    });
    await propagateGoalToChildren(cycle.strategicGoalId);
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of ["statut", "priorite", "axe", "resultatAttendu", "perimetre", "responsable"] as const) {
    if (body[k] !== undefined && (updated as any)[k] !== (cycle as any)[k]) changes[k] = { from: (cycle as any)[k], to: (updated as any)[k] };
  }
  if (body.libelle !== undefined && String(body.libelle).trim() !== cycle.strategicGoal.libelle) changes.libelle = { from: cycle.strategicGoal.libelle, to: String(body.libelle).trim() };
  if (Object.keys(changes).length > 0) {
    await logAudit({ entityType: "objectif", entityId: params.id, entityLabel: String(body.libelle ?? cycle.strategicGoal.libelle).slice(0, 120), action: "update", changes, user });
  }
  return NextResponse.json(updated);
}
