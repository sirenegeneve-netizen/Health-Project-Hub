import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isFrequence, isIndicatorStatut, isSens, lockedIndicatorFields, toNumberOrNull } from "@/lib/objectifs";
import { propagateIndicatorDefinition } from "@/lib/objectifsDb";

async function load(id: string) {
  return prisma.goalIndicator.findUnique({ where: { id }, include: { strategicGoalCycle: { select: { id: true, strategicGoal: { select: { libelle: true } } } } } });
}

// La définition (nom, description, unité, sens, fréquence) est maîtrisée au niveau Groupe : verrouillée sur la
// copie d'un établissement, qui renseigne sa valeur initiale, sa cible locale (facultative), son échéance, son
// responsable et son statut. Les mesures se saisissent dans /measures.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const current = await load(params.id);
  if (!current) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });

  const body = await req.json();
  const locked = lockedIndicatorFields(!!current.parentIndicatorId, body);
  if (locked.length > 0) {
    return NextResponse.json({ error: "Cet indicateur est défini par le groupe (comparabilité entre établissements) : sa définition ne peut pas être modifiée ici.", code: "inherited_locked", fields: locked }, { status: 403 });
  }
  if (body.nom !== undefined && !String(body.nom).trim()) return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
  if (body.sens !== undefined && !isSens(body.sens)) return NextResponse.json({ error: "Sens invalide." }, { status: 400 });
  if (body.frequence !== undefined && !isFrequence(body.frequence)) return NextResponse.json({ error: "Fréquence invalide." }, { status: 400 });
  if (body.statut !== undefined && !isIndicatorStatut(body.statut)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  const num = (v: unknown) => (v === undefined ? undefined : toNumberOrNull(v));
  const initiale = num(body.valeurInitiale);
  const cible = num(body.valeurCible);
  const seuil = num(body.seuilAlerte);
  if ([initiale, cible, seuil].some((n) => n !== undefined && Number.isNaN(n))) return NextResponse.json({ error: "Les valeurs doivent être des nombres." }, { status: 400 });

  let responsable: string | null | undefined = undefined;
  if (body.responsableActorId !== undefined) {
    const actor = body.responsableActorId ? await prisma.actor.findUnique({ where: { id: body.responsableActorId }, select: { name: true } }) : null;
    responsable = actor?.name || null;
  }
  const text = (v: unknown) => (v === undefined ? undefined : v ? String(v) : null);

  const updated = await prisma.goalIndicator.update({
    where: { id: params.id },
    data: {
      nom: body.nom === undefined ? undefined : String(body.nom).trim(),
      description: text(body.description),
      unite: text(body.unite),
      sens: body.sens,
      frequence: body.frequence,
      valeurInitiale: initiale as number | null | undefined,
      valeurCible: cible as number | null | undefined,
      seuilAlerte: seuil as number | null | undefined,
      echeance: body.echeance === undefined ? undefined : body.echeance ? new Date(body.echeance) : null,
      responsableActorId: body.responsableActorId === undefined ? undefined : body.responsableActorId || null,
      responsable,
      statut: body.statut,
      principal: typeof body.principal === "boolean" ? body.principal : undefined,
    },
  });
  if (body.principal === true) {
    await prisma.goalIndicator.updateMany({ where: { strategicGoalCycleId: updated.strategicGoalCycleId, id: { not: updated.id } }, data: { principal: false } });
  }
  if (!current.parentIndicatorId) await propagateIndicatorDefinition(updated.id);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of ["nom", "unite", "sens", "frequence", "valeurInitiale", "valeurCible", "statut"] as const) {
    if (body[k] !== undefined && (updated as any)[k] !== (current as any)[k]) changes[`${current.nom}.${k}`] = { from: (current as any)[k], to: (updated as any)[k] };
  }
  if (Object.keys(changes).length > 0) {
    await logAudit({ entityType: "objectif", entityId: current.strategicGoalCycleId, entityLabel: current.strategicGoalCycle.strategicGoal.libelle.slice(0, 120), action: "update", changes, user });
  }
  return NextResponse.json(updated);
}

// Suppression volontairement restreinte : un indicateur qui a des mesures, ou des copies d'établissements, ne
// se supprime pas (historique) — on le passe au statut « abandonné ». La copie d'un établissement ne se supprime pas.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const current = await load(params.id);
  if (!current) return NextResponse.json({ error: "Indicateur introuvable." }, { status: 404 });

  if (current.parentIndicatorId) return NextResponse.json({ error: "Cet indicateur est défini par le groupe : il ne peut pas être supprimé ici (vous pouvez le passer au statut « abandonné »)." }, { status: 409 });
  const [measures, copies] = await Promise.all([
    prisma.goalIndicatorMeasure.count({ where: { goalIndicatorId: params.id } }),
    prisma.goalIndicator.count({ where: { parentIndicatorId: params.id } }),
  ]);
  if (measures > 0 || copies > 0) {
    return NextResponse.json({ error: "Cet indicateur a des mesures ou des copies dans des établissements : passez-le au statut « abandonné » pour conserver l'historique.", code: "has_history" }, { status: 409 });
  }
  await prisma.goalIndicator.delete({ where: { id: params.id } });
  await logAudit({ entityType: "objectif", entityId: current.strategicGoalCycleId, entityLabel: current.strategicGoalCycle.strategicGoal.libelle.slice(0, 120), action: "update", changes: { indicateur_retire: { from: current.nom, to: null } }, user });
  return NextResponse.json({ ok: true });
}
