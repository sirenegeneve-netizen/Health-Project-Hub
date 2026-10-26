import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncGroupDiffusion } from "@/lib/diffusionDb";
import {
  applyDerogation,
  applyStateAction,
  diffSourceFields,
  fieldsToApply,
  isEtat,
  pendingChanges,
  planSelection,
  suggestInitialState,
  validateSelectionInput,
  ETAT_LABELS,
} from "@/lib/declinaison";
import type { DerogationAction, FieldChange, StateAction } from "@/lib/declinaison";

// Déclinaison d'un objectif de groupe dans un établissement — accès base (P1).
// Principes : ajouts et mises à jour seulement, jamais de suppression de déclinaison, d'action, de mesure ni de preuve ;
// la cible locale, les indicateurs locaux, le responsable et le statut ne sont jamais modifiés ici.
// Les gardes d'autorisation sont posées par les ROUTES, avant l'appel à ces fonctions.

interface AuditUser {
  id: string;
  name: string;
}

export interface DbResult {
  ok: boolean;
  error?: string;
  status?: number;
  data?: any;
}

const bad = (error: string, status = 400): DbResult => ({ ok: false, error, status });

// Établissement d'une déclinaison = propriétaire de l'objectif stable lié au cycle.
async function loadChild(childCycleId: string) {
  const c = await prisma.strategicGoalCycle.findUnique({
    where: { id: childCycleId },
    include: { strategicGoal: { select: { id: true, libelle: true, ownerType: true, ownerId: true } } },
  });
  if (!c || !c.parentCycleId || c.strategicGoal.ownerType !== "etablissement") return null;
  return c;
}

async function loadGroupCycle(cycleId: string) {
  const c = await prisma.strategicGoalCycle.findUnique({
    where: { id: cycleId },
    include: { strategicGoal: true, strategicPlan: true },
  });
  if (!c || c.parentCycleId || c.strategicGoal.ownerType !== "groupe") return null;
  return c;
}

// --- Diffusion sélective ------------------------------------------------------------------------------------------

export interface SelectionSummary {
  mode: string;
  targets: number;
  toCreate: number;
  toRestore: number;
  toRemove: number;
  created?: number;
}

// Calcule le plan de diffusion (simulation) sans rien écrire.
export async function previewSelection(groupCycleId: string, mode: unknown, selectedIds: unknown): Promise<DbResult> {
  const cycle = await loadGroupCycle(groupCycleId);
  if (!cycle) return bad("Seul un objectif propre au groupe peut être diffusé.", 404);
  const ests = await prisma.establishment.findMany({ where: { groupId: cycle.strategicGoal.ownerId }, select: { id: true } });
  const all = ests.map((e) => e.id);
  const err = validateSelectionInput(mode, selectedIds, all);
  if (err) return bad(err);
  const children = await prisma.strategicGoalCycle.findMany({
    where: { parentCycleId: groupCycleId },
    select: { miseEnOeuvre: true, strategicGoal: { select: { ownerId: true } } },
  });
  const plan = planSelection({
    mode: mode as "tous" | "selection",
    selectedIds: (selectedIds as string[]) || [],
    allEstablishmentIds: all,
    existingChildren: children.map((c) => ({ establishmentId: c.strategicGoal.ownerId, miseEnOeuvre: c.miseEnOeuvre })),
  });
  return { ok: true, data: plan };
}

// Applique une sélection de diffusion. Idempotent. Un établissement retiré garde sa déclinaison (« Hors périmètre », état
// précédent mémorisé) ; s'il revient, l'état est restauré. Aucun doublon, aucune suppression de déclinaison.
export async function applySelection(groupCycleId: string, mode: unknown, selectedIds: unknown, user: AuditUser): Promise<DbResult> {
  const cycle = await loadGroupCycle(groupCycleId);
  if (!cycle) return bad("Seul un objectif propre au groupe peut être diffusé.", 404);
  const preview = await previewSelection(groupCycleId, mode, selectedIds);
  if (!preview.ok) return preview;
  const plan = preview.data;
  const previousMode = cycle.diffusion;
  const now = new Date();

  // 1) Enregistrer le mode et la liste des destinataires, marquer l'objectif et le plan comme diffusés.
  await prisma.$transaction([
    prisma.strategicGoal.update({ where: { id: cycle.strategicGoalId }, data: { diffuse: true } }),
    prisma.strategicPlan.update({ where: { id: cycle.strategicPlanId }, data: { diffuse: true } }),
    prisma.strategicGoalCycle.update({ where: { id: cycle.id }, data: { diffusion: mode as string } }),
  ]);
  // Liste de destinataires : lignes de configuration, remplacées (aucune donnée métier). Vide en mode « tous ».
  await prisma.goalDiffusionTarget.deleteMany({ where: { strategicGoalCycleId: cycle.id } });
  if (mode === "selection" && plan.targets.length > 0) {
    await prisma.goalDiffusionTarget.createMany({
      data: plan.targets.map((id: string) => ({ strategicGoalCycleId: cycle.id, establishmentId: id })),
      skipDuplicates: true,
    });
  }

  // 2) Créer les déclinaisons manquantes (la synchronisation respecte la sélection — étape 2 du plan).
  const sync = await syncGroupDiffusion(cycle.strategicGoal.ownerId);

  // 3) Restaurer / marquer hors périmètre.
  const children = await prisma.strategicGoalCycle.findMany({
    where: { parentCycleId: groupCycleId },
    select: { id: true, miseEnOeuvre: true, etatAvantSortie: true, strategicGoal: { select: { ownerId: true } } },
  });
  const byEst = new Map(children.map((c) => [c.strategicGoal.ownerId, c]));
  for (const estId of plan.toRestore as string[]) {
    const c = byEst.get(estId);
    if (!c) continue;
    const back = isEtat(c.etatAvantSortie) && c.etatAvantSortie !== "hors_perimetre" ? c.etatAvantSortie : "non_pris_en_charge";
    await prisma.strategicGoalCycle.update({ where: { id: c.id }, data: { miseEnOeuvre: back, miseEnOeuvreMajLe: now, etatAvantSortie: null, horsPerimetreLe: null } });
  }
  for (const estId of plan.toRemove as string[]) {
    const c = byEst.get(estId);
    if (!c) continue;
    await prisma.strategicGoalCycle.update({
      where: { id: c.id },
      data: { etatAvantSortie: c.miseEnOeuvre || "non_pris_en_charge", miseEnOeuvre: "hors_perimetre", miseEnOeuvreMajLe: now, horsPerimetreLe: now },
    });
  }

  await logAudit({
    entityType: "objectif",
    entityId: cycle.id,
    entityLabel: cycle.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: {
      diffusion: { from: previousMode, to: `${mode} (${plan.targets.length} établissement(s))` },
      ...(plan.toRemove.length ? { horsPerimetre: { from: null, to: `${plan.toRemove.length} établissement(s)` } } : {}),
      ...(plan.toRestore.length ? { retourPerimetre: { from: null, to: `${plan.toRestore.length} établissement(s)` } } : {}),
    },
    user,
  });
  const summary: SelectionSummary = {
    mode: mode as string,
    targets: plan.targets.length,
    toCreate: plan.toCreate.length,
    toRestore: plan.toRestore.length,
    toRemove: plan.toRemove.length,
    created: sync.cyclesCreated,
  };
  return { ok: true, data: summary };
}

// --- États de prise en charge -------------------------------------------------------------------------------------

export async function changeState(childCycleId: string, action: StateAction, user: AuditUser): Promise<DbResult> {
  const c = await loadChild(childCycleId);
  if (!c) return bad("Déclinaison introuvable.", 404);
  const res = applyStateAction(c.miseEnOeuvre, c.derogationStatut, action);
  if (!res.ok) return bad(res.error!, 409);
  const next = res.value!;
  // Mise à jour conditionnelle : si l'état a changé entre-temps, rien n'est écrit.
  const upd = await prisma.strategicGoalCycle.updateMany({
    where: { id: c.id, miseEnOeuvre: c.miseEnOeuvre },
    data: { miseEnOeuvre: next, miseEnOeuvreMajLe: new Date() },
  });
  if (upd.count === 0) return bad("L'état a changé entre-temps : rechargez la page.", 409);
  await logAudit({
    entityType: "objectif",
    entityId: c.id,
    entityLabel: c.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: { miseEnOeuvre: { from: c.miseEnOeuvre || "non_pris_en_charge", to: next } },
    user,
  });
  return { ok: true, data: { etat: next, label: ETAT_LABELS[next] } };
}

// --- Dérogation ---------------------------------------------------------------------------------------------------

export async function changeDerogation(
  childCycleId: string,
  action: DerogationAction,
  input: { motif?: string; note?: string },
  user: AuditUser
): Promise<DbResult> {
  const c = await loadChild(childCycleId);
  if (!c) return bad("Déclinaison introuvable.", 404);
  const res = applyDerogation({ etat: c.miseEnOeuvre, statut: c.derogationStatut }, action, input);
  if (!res.ok) return bad(res.error!, 409);
  const v = res.value!;
  const now = new Date();
  const data: Record<string, unknown> = { derogationStatut: v.statut, miseEnOeuvre: v.etat, miseEnOeuvreMajLe: now };
  if (action === "demander") {
    data.derogationMotif = input.motif!.trim();
    data.derogationDemandeePar = user.name;
    data.derogationDecisionPar = null;
    data.derogationDecisionLe = null;
    data.derogationDecisionNote = null;
  } else if (action === "retirer") {
    data.derogationStatut = null;
  } else if (action === "valider" || action === "refuser") {
    data.derogationDecisionPar = user.name;
    data.derogationDecisionLe = now;
    data.derogationDecisionNote = input.note ? input.note.trim() : null;
  } else if (action === "revoquer") {
    data.derogationDecisionPar = user.name;
    data.derogationDecisionLe = now;
    data.derogationDecisionNote = input.note ? input.note.trim() : null;
    data.derogationStatut = null;
  }
  const upd = await prisma.strategicGoalCycle.updateMany({
    where: { id: c.id, derogationStatut: c.derogationStatut, miseEnOeuvre: c.miseEnOeuvre },
    data,
  });
  if (upd.count === 0) return bad("La dérogation a changé entre-temps : rechargez la page.", 409);
  await logAudit({
    entityType: "objectif",
    entityId: c.id,
    entityLabel: c.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: {
      derogation: { from: c.derogationStatut || "aucune", to: `${action}${input.motif ? " — " + input.motif.trim().slice(0, 100) : ""}${input.note ? " — " + input.note.trim().slice(0, 100) : ""}` },
      miseEnOeuvre: { from: c.miseEnOeuvre || "non_pris_en_charge", to: v.etat },
    },
    user,
  });
  return { ok: true, data: { etat: v.etat, statut: v.statut } };
}

// --- Changements du groupe ----------------------------------------------------------------------------------------

// Enregistre un changement d'un objectif de groupe diffusé (avant / après sur les champs suivis). Ne touche à aucune déclinaison.
// `before` et `after` : valeurs du cycle de groupe ET de son objectif stable (intitulé, description) fusionnées par l'appelant.
export async function recordSourceChange(sourceCycleId: string, before: Record<string, unknown>, after: Record<string, unknown>, user: AuditUser | null): Promise<DbResult> {
  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: sourceCycleId }, select: { id: true, diffusion: true, parentCycleId: true } });
  if (!cycle || cycle.parentCycleId || cycle.diffusion === "aucune") return { ok: true, data: { recorded: false } };
  const diff = diffSourceFields(before, after);
  if (Object.keys(diff).length === 0) return { ok: true, data: { recorded: false } };
  const row = await prisma.goalSourceChange.create({ data: { sourceCycleId, changes: diff as any, auteur: user ? user.name : null } });
  return { ok: true, data: { recorded: true, id: row.id, fields: Object.keys(diff) } };
}

// Changements encore à examiner pour une déclinaison.
export async function listPendingChanges(childCycleId: string) {
  const c = await prisma.strategicGoalCycle.findUnique({ where: { id: childCycleId }, select: { id: true, parentCycleId: true, createdAt: true } });
  if (!c || !c.parentCycleId) return [];
  const [changes, reviews] = await Promise.all([
    prisma.goalSourceChange.findMany({ where: { sourceCycleId: c.parentCycleId }, orderBy: { createdAt: "asc" } }),
    prisma.goalChangeReview.findMany({ where: { childCycleId }, select: { changeId: true } }),
  ]);
  return pendingChanges(changes, reviews.map((r) => r.changeId), c.createdAt);
}

// Décision d'une déclinaison sur un changement : « accepte » recopie uniquement les champs non propagés automatiquement
// depuis le cycle de groupe ; « ignore » conserve le local. Décision historisée, une seule par changement et par déclinaison.
export async function reviewChange(childCycleId: string, changeId: string, decision: unknown, user: AuditUser): Promise<DbResult> {
  if (decision !== "accepte" && decision !== "ignore") return bad("Décision invalide.");
  const c = await loadChild(childCycleId);
  if (!c) return bad("Déclinaison introuvable.", 404);
  if (c.miseEnOeuvre === "hors_perimetre") return bad("Cet établissement est hors périmètre : la déclinaison est en lecture seule.", 409);
  const change = await prisma.goalSourceChange.findUnique({ where: { id: changeId } });
  if (!change || change.sourceCycleId !== c.parentCycleId) return bad("Changement introuvable pour cette déclinaison.", 404);
  const already = await prisma.goalChangeReview.findUnique({ where: { changeId_childCycleId: { changeId, childCycleId } } });
  if (already) return bad("Ce changement a déjà été examiné.", 409);

  let applied: string[] = [];
  if (decision === "accepte") {
    const source = await prisma.strategicGoalCycle.findUnique({ where: { id: c.parentCycleId! } });
    if (!source) return bad("Objectif du groupe introuvable.", 404);
    applied = fieldsToApply(change.changes as unknown as Record<string, FieldChange>);
    const data: Record<string, unknown> = {};
    // Valeurs ACTUELLES du groupe pour les champs concernés (jamais cible, indicateurs, responsable ni statut).
    for (const k of applied) data[k] = (source as any)[k];
    if (Object.keys(data).length > 0) await prisma.strategicGoalCycle.update({ where: { id: c.id }, data });
  }
  await prisma.goalChangeReview.create({
    data: { changeId, childCycleId, decision, appliedFields: applied as any, decidePar: user.name },
  });
  await logAudit({
    entityType: "objectif",
    entityId: c.id,
    entityLabel: c.strategicGoal.libelle.slice(0, 120),
    action: "update",
    changes: { changementGroupe: { from: "à examiner", to: decision === "accepte" ? `accepté (${applied.join(", ") || "aucun champ à recopier"})` : "ignoré" } },
    user,
  });
  return { ok: true, data: { decision, applied } };
}

// --- États de départ des déclinaisons existantes ------------------------------------------------------------------

export interface InitialStateRow {
  childCycleId: string;
  establishmentId: string;
  proposed: "en_cours" | "non_pris_en_charge";
}

// Déclinaisons sans état : propose « en cours » si elles ont déjà une action, une mesure, une valeur initiale ou un responsable.
// dryRun = true (défaut) : simulation, aucune écriture. Ne touche jamais une déclinaison dont l'état est déjà renseigné.
export async function computeInitialStates(groupId: string, dryRun = true, user: AuditUser | null = null): Promise<DbResult> {
  const ests = await prisma.establishment.findMany({ where: { groupId }, select: { id: true } });
  const children = await prisma.strategicGoalCycle.findMany({
    where: { parentCycleId: { not: null }, miseEnOeuvre: null, strategicGoal: { ownerType: "etablissement", ownerId: { in: ests.map((e) => e.id) } } },
    select: {
      id: true,
      responsable: true,
      responsableActorId: true,
      strategicGoal: { select: { ownerId: true } },
      _count: { select: { actions: true } },
      indicators: { select: { valeurInitiale: true, _count: { select: { measures: true, baselines: true } } } },
    },
  });
  const rows: InitialStateRow[] = children.map((c) => {
    const measures = c.indicators.reduce((n, i) => n + i._count.measures, 0);
    const baselines = c.indicators.reduce((n, i) => n + i._count.baselines + (i.valeurInitiale !== null && i.valeurInitiale !== undefined ? 1 : 0), 0);
    return {
      childCycleId: c.id,
      establishmentId: c.strategicGoal.ownerId,
      proposed: suggestInitialState({ actions: c._count.actions, measures, baselines, hasResponsable: !!(c.responsable || c.responsableActorId) }),
    };
  });
  const summary = {
    total: rows.length,
    enCours: rows.filter((r) => r.proposed === "en_cours").length,
    nonPrisEnCharge: rows.filter((r) => r.proposed === "non_pris_en_charge").length,
  };
  if (dryRun) return { ok: true, data: { dryRun: true, ...summary } };
  const now = new Date();
  let updated = 0;
  for (const r of rows) {
    // Condition miseEnOeuvre: null → idempotent, n'écrase jamais un état déjà déclaré.
    const res = await prisma.strategicGoalCycle.updateMany({ where: { id: r.childCycleId, miseEnOeuvre: null }, data: { miseEnOeuvre: r.proposed, miseEnOeuvreMajLe: now } });
    updated += res.count;
  }
  await logAudit({ entityType: "objectif", entityId: groupId, entityLabel: "États de départ des déclinaisons", action: "update", changes: { etatsDeDepart: { from: null, to: `${updated} déclinaison(s) initialisée(s)` } }, user });
  return { ok: true, data: { dryRun: false, ...summary, updated } };
}
