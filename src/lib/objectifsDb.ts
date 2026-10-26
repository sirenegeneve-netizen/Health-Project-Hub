import { prisma } from "@/lib/db";
import { sanitizeCodes, isTheme, PERIMETRES_ORGANISATIONNELS, POPULATIONS, normalizePopulations } from "@/lib/referentiels";
import { syncGroupDiffusion, syncIndicatorsToChildren } from "@/lib/diffusionDb";
import { listPendingChanges } from "@/lib/declinaisonDb";
import { ETAT_LABELS, fieldsToApply, isEtat, pendingChanges } from "@/lib/declinaison";
import type { FieldChange } from "@/lib/declinaison";
import {
  currentValue,
  effectiveIndicator,
  formatTarget,
  indicatorProgress,
  objectiveProgress,
  rollupProgress,
  resolveParentCycleId,
  baselineState,
  buildBaselineAction,
  planBaselineAction,
  toNumberOrNull,
  type IndicatorInput,
  type LinkKind,
} from "@/lib/objectifs";

// Objectif = unité de pilotage (accès base). Additif : n'écrit que dans les nouvelles colonnes / tables
// et dans les objets existants (Action, StrategicGoal, StrategicGoalCycle) sans en retirer aucun champ.

export interface Result {
  ok: boolean;
  status?: number;
  error?: string;
  id?: string;
}

async function actorName(actorId?: string | null): Promise<string | null> {
  if (!actorId) return null;
  const actor = await prisma.actor.findUnique({ where: { id: actorId }, select: { name: true } });
  return actor?.name || null;
}

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

// --- Création d'un objectif en une seule transaction ---------------------------------------------------------------

export async function createObjective(body: any): Promise<Result> {
  const plan = await prisma.strategicPlan.findUnique({ where: { id: body.strategicPlanId } });
  if (!plan) return { ok: false, status: 404, error: "Plan stratégique introuvable." };
  const ownerType = plan.ownerType;
  const ownerId = plan.ownerId;
  if (body.ownerType && body.ownerId && (body.ownerType !== ownerType || body.ownerId !== ownerId)) {
    return { ok: false, status: 400, error: "Le plan doit appartenir au même groupe ou établissement que l'objectif." };
  }

  const responsable = await actorName(body.responsableActorId);
  const indicators: IndicatorInput[] = Array.isArray(body.indicators) ? body.indicators : [];
  const actions: any[] = Array.isArray(body.actions) ? body.actions : [];
  const principalIdx = Math.max(0, indicators.findIndex((i: any) => i.principal === true));
  const diffuse = ownerType === "groupe" && body.diffuse === true;

  // Périmètre structuré : établissements précisés = établissements existants du groupe (jamais de texte en doublon).
  let scopeEstablishmentIds: string[] = [];
  if (ownerType === "groupe" && Array.isArray(body.scopeEstablishmentIds) && body.scopeEstablishmentIds.length > 0) {
    const wantedScope: string[] = Array.from(new Set<string>((body.scopeEstablishmentIds as unknown[]).map((v) => String(v))));
    const found = await prisma.establishment.findMany({ where: { id: { in: wantedScope }, groupId: ownerId }, select: { id: true } });
    if (found.length !== wantedScope.length) return { ok: false, status: 400, error: "Établissement hors du groupe ou introuvable dans le périmètre." };
    scopeEstablishmentIds = found.map((e) => e.id);
  }
  // État des lieux initial : une seule action pour tous les indicateurs sans valeur initiale.
  const baselinePlan = planBaselineAction({ indicators: indicators.map((i) => ({ nom: i.nom, valeurInitiale: i.valeurInitiale })), wanted: !!body.baselineAction && body.baselineAction.create !== false });

  const cycleId = await prisma.$transaction(
    async (tx) => {
      const goal = await tx.strategicGoal.create({
        data: { ownerType, ownerId, libelle: String(body.libelle).trim(), description: body.description ? String(body.description) : null, diffuse },
      });
      const cycle = await tx.strategicGoalCycle.create({
        data: {
          strategicGoalId: goal.id,
          strategicPlanId: plan.id,
          statut: body.statut || "actif",
          priorite: body.priorite || "normale",
          responsableActorId: body.responsableActorId || null,
          responsable,
          axe: body.axe ? String(body.axe) : null,
          resultatAttendu: body.resultatAttendu ? String(body.resultatAttendu) : null,
          perimetre: body.perimetre ? String(body.perimetre) : null, // précision facultative (ex-texte libre)
          perimetreOrg: sanitizeCodes(PERIMETRES_ORGANISATIONNELS, body.perimetreOrg),
          populations: normalizePopulations(sanitizeCodes(POPULATIONS, body.populations)),
          echeance: toDate(body.echeance),
          diffusion: diffuse ? "tous" : "aucune",
        },
      });
      if (scopeEstablishmentIds.length > 0) {
        await tx.goalCycleScopeEstablishment.createMany({ data: scopeEstablishmentIds.map((establishmentId) => ({ strategicGoalCycleId: cycle.id, establishmentId })), skipDuplicates: true });
      }

      const createdIndicators: { id: string }[] = [];
      for (let i = 0; i < indicators.length; i++) {
        const ind = indicators[i];
        const indResponsable = await actorName((ind as any).responsableActorId);
        const created = await tx.goalIndicator.create({
          data: {
            strategicGoalCycleId: cycle.id,
            nom: String(ind.nom).trim(),
            description: ind.description || null,
            unite: ind.unite || null,
            sens: ind.sens || "hausse",
            valeurInitiale: toNumberOrNull(ind.valeurInitiale),
            valeurCible: toNumberOrNull(ind.valeurCible),
            frequence: ind.frequence || "trimestrielle",
            echeance: toDate(ind.echeance),
            responsableActorId: (ind as any).responsableActorId || null,
            responsable: indResponsable || ind.responsable || null,
            statut: ind.statut || "actif",
            principal: i === principalIdx,
            theme: ind.theme && isTheme(ind.theme) ? ind.theme : null,
          },
        });
        createdIndicators.push(created);
        // Valeur initiale réellement connue (zéro compris) : on trace sa source et sa date dès la création.
        const initiale = toNumberOrNull(ind.valeurInitiale);
        if (initiale !== null) {
          await tx.goalIndicatorBaseline.create({
            data: { goalIndicatorId: created.id, valeur: initiale, dateMesure: toDate(ind.baselineDate) || new Date(), source: ind.baselineSource ? String(ind.baselineSource) : "saisie à la création", statut: "valide", auteur: body.__userName || null, valideLe: new Date(), validePar: body.__userName || null },
          });
        }
        const actuelle = toNumberOrNull(ind.valeurActuelle);
        if (actuelle !== null) {
          await tx.goalIndicatorMeasure.create({ data: { goalIndicatorId: created.id, valeur: actuelle, dateMesure: new Date(), source: "création de l'objectif" } });
        }
      }

      if (baselinePlan.create) {
        const draft = buildBaselineAction({ objectif: String(body.libelle), indicators: baselinePlan.indexes.map((i) => ({ nom: indicators[i].nom, unite: indicators[i].unite })), ownerType });
        const ba = body.baselineAction || {};
        const baResponsable = await actorName(ba.responsableActorId);
        const action = await tx.action.create({
          data: {
            ownerType,
            ownerId,
            establishmentId: ownerType === "etablissement" ? ownerId : null,
            strategicGoalCycleId: cycle.id,
            indicatorId: baselinePlan.indexes.length === 1 ? createdIndicators[baselinePlan.indexes[0]].id : null,
            title: ba.title && String(ba.title).trim() ? String(ba.title).trim() : draft.title,
            comments: ba.description && String(ba.description).trim() ? String(ba.description) : draft.description,
            livrable: ba.livrable && String(ba.livrable).trim() ? String(ba.livrable) : draft.livrable,
            responsableActorId: ba.responsableActorId || null,
            responsable: baResponsable,
            priority: ba.priority || "haute",
            echeance: toDate(ba.echeance),
            status: ba.status || "a_faire",
            origine: "etat_des_lieux",
          },
        });
        await tx.goalIndicator.updateMany({ where: { id: { in: baselinePlan.indexes.map((i) => createdIndicators[i].id) } }, data: { baselineActionId: action.id } });
      }

      for (const a of actions) {
        const aResponsable = await actorName(a.responsableActorId);
        await tx.action.create({
          data: {
            ownerType,
            ownerId,
            establishmentId: ownerType === "etablissement" ? ownerId : null,
            strategicGoalCycleId: cycle.id,
            indicatorId: typeof a.indicatorIndex === "number" ? createdIndicators[a.indicatorIndex]?.id ?? null : null,
            title: String(a.title).trim(),
            comments: a.description ? String(a.description) : null,
            responsableActorId: a.responsableActorId || null,
            responsable: aResponsable,
            priority: a.priority || "normale",
            echeance: toDate(a.echeance),
            status: a.status || "a_faire",
            livrable: a.livrable ? String(a.livrable) : null,
            origine: a.origine || "manuel",
          },
        });
      }

      if (diffuse && !plan.diffuse) await tx.strategicPlan.update({ where: { id: plan.id }, data: { diffuse: true } });
      return cycle.id;
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  if (diffuse) {
    await syncGroupDiffusion(ownerId);
    await syncIndicatorsToChildren(cycleId);
  }
  return { ok: true, id: cycleId };
}

// --- Indicateurs : héritage de la définition Groupe (la copie initiale est dans diffusionDb) ----------------------

// Un changement de définition côté groupe est répercuté sur les copies (jamais les valeurs de l'établissement).
export async function propagateIndicatorDefinition(indicatorId: string): Promise<number> {
  const parent = await prisma.goalIndicator.findUnique({ where: { id: indicatorId } });
  if (!parent) return 0;
  const res = await prisma.goalIndicator.updateMany({
    where: { parentIndicatorId: indicatorId },
    data: { nom: parent.nom, description: parent.description, unite: parent.unite, sens: parent.sens, frequence: parent.frequence, theme: parent.theme },
  });
  return res.count;
}

// --- Synthèse (liste) et détail (fiche) ---------------------------------------------------------------------------

async function indicatorViews(cycleIds: string[]) {
  const indicators = await prisma.goalIndicator.findMany({
    where: { strategicGoalCycleId: { in: cycleIds } },
    include: {
      measures: { select: { id: true, valeur: true, dateMesure: true, createdAt: true, commentaire: true }, orderBy: { dateMesure: "desc" } },
      baselines: { select: { id: true, valeur: true, dateMesure: true, source: true, justificatif: true, statut: true, auteur: true, validePar: true, valideLe: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
  });
  const parentIds = Array.from(new Set(indicators.map((i) => i.parentIndicatorId).filter(Boolean))) as string[];
  const parents = parentIds.length ? await prisma.goalIndicator.findMany({ where: { id: { in: parentIds } } }) : [];
  const parentById = new Map(parents.map((p) => [p.id, p]));
  return indicators.map((i) => {
    const parent = i.parentIndicatorId ? parentById.get(i.parentIndicatorId) || null : null;
    const eff = effectiveIndicator(i, parent);
    const actuelle = currentValue(i.measures);
    return {
      ...eff,
      id: i.id,
      strategicGoalCycleId: i.strategicGoalCycleId,
      parentIndicatorId: i.parentIndicatorId,
      measures: i.measures,
      baselines: i.baselines,
      baselineActionId: i.baselineActionId,
      baselineState: baselineState({ valeurInitiale: eff.valeurInitiale, baselines: i.baselines }),
      actuelle,
      progress: indicatorProgress({ valeurInitiale: eff.valeurInitiale, valeurCible: eff.valeurCible, actuelle }),
    };
  });
}

export interface ObjectiveSummary {
  id: string;
  libelle: string;
  description: string | null;
  plan: { id: string; libelle: string };
  statut: string;
  priorite: string;
  responsable: string | null;
  echeance: Date | null;
  diffusion: string;
  inherited: boolean;
  cibleLabel: string | null;
  counts: { actions: number; indicateurs: number; initiatives: number };
  progress: ReturnType<typeof objectiveProgress>;
  rollup: ReturnType<typeof rollupProgress> | null;
}

export async function summarizeObjectives(ownerType: string, ownerId: string): Promise<ObjectiveSummary[]> {
  const cycles = await prisma.strategicGoalCycle.findMany({
    where: { strategicGoal: { ownerType, ownerId } },
    include: {
      strategicGoal: true,
      strategicPlan: { select: { id: true, libelle: true, startDate: true } },
      actions: { select: { status: true } },
      contributions: { select: { id: true } },
    },
    orderBy: [{ strategicPlan: { startDate: "desc" } }, { createdAt: "asc" }],
  });
  if (cycles.length === 0) return [];
  const ids = cycles.map((c) => c.id);
  const inds = await indicatorViews(ids);

  // Synthèse des déclinaisons (objectifs de groupe diffusés)
  const children = await prisma.strategicGoalCycle.findMany({
    where: { parentCycleId: { in: ids } },
    select: { id: true, parentCycleId: true, actions: { select: { status: true } } },
  });
  const childInds = children.length ? await indicatorViews(children.map((c) => c.id)) : [];
  const [sourceChanges, childReviews] = children.length
    ? await Promise.all([
        prisma.goalSourceChange.findMany({ where: { sourceCycleId: cycleId }, orderBy: { createdAt: "asc" } }),
        prisma.goalChangeReview.findMany({ where: { childCycleId: { in: children.map((c) => c.id) } }, select: { changeId: true, childCycleId: true } }),
      ])
    : [[], []];
  const reviewsByChild = new Map<string, string[]>();
  for (const r of childReviews) reviewsByChild.set(r.childCycleId, [...(reviewsByChild.get(r.childCycleId) || []), r.changeId]);
  const childProgress = new Map<string, { percent: number | null }[]>();
  for (const ch of children) {
    const p = objectiveProgress({ indicators: childInds.filter((i) => i.strategicGoalCycleId === ch.id), actions: ch.actions });
    const list = childProgress.get(ch.parentCycleId as string) || [];
    list.push({ percent: p.percent });
    childProgress.set(ch.parentCycleId as string, list);
  }

  return cycles.map((c) => {
    const own = inds.filter((i) => i.strategicGoalCycleId === c.id);
    const principal = own.find((i) => i.principal) || own[0] || null;
    const kids = childProgress.get(c.id);
    return {
      id: c.id,
      libelle: c.strategicGoal.libelle,
      description: c.strategicGoal.description,
      plan: { id: c.strategicPlan.id, libelle: c.strategicPlan.libelle },
      statut: c.statut,
      priorite: c.priorite,
      responsable: c.responsable,
      echeance: c.echeance,
      diffusion: c.diffusion,
      inherited: !!c.parentCycleId,
      cibleLabel: formatTarget(principal),
      counts: { actions: c.actions.length, indicateurs: own.length, initiatives: c.contributions.length },
      progress: objectiveProgress({ indicators: own, actions: c.actions }),
      rollup: kids ? rollupProgress(kids) : null,
    };
  });
}

export async function loadObjectiveDetail(cycleId: string) {
  const cycle = await prisma.strategicGoalCycle.findUnique({
    where: { id: cycleId },
    include: {
      strategicGoal: true,
      strategicPlan: true,
      actions: { orderBy: [{ echeance: "asc" }, { createdAt: "asc" }] },
      scopeEstablishments: { include: { establishment: { select: { id: true, name: true } } } },
      contributions: { include: { initiative: { select: { id: true, name: true, reference: true, phase: true, status: true } } } },
      links: true,
    },
  });
  if (!cycle) return null;

  const indicators = await indicatorViews([cycleId]);
  const links = cycle.links;
  const [risks, decisions, findings, requirements, children] = await Promise.all([
    prisma.risk.findMany({ where: { id: { in: links.map((l) => l.riskId).filter(Boolean) as string[] } }, select: { id: true, description: true, criticite: true, status: true } }),
    prisma.decision.findMany({ where: { id: { in: links.map((l) => l.decisionId).filter(Boolean) as string[] } }, select: { id: true, subject: true, status: true, date: true } }),
    prisma.auditFinding.findMany({ where: { id: { in: links.map((l) => l.auditFindingId).filter(Boolean) as string[] } }, select: { id: true, libelle: true, type: true, statut: true } }),
    prisma.qualityRequirement.findMany({ where: { id: { in: links.map((l) => l.qualityRequirementId).filter(Boolean) as string[] } }, select: { id: true, referentiel: true, code: true, libelle: true } }),
    prisma.strategicGoalCycle.findMany({
      where: { parentCycleId: cycleId },
      select: {
        id: true, statut: true, createdAt: true, strategicGoal: { select: { ownerId: true } }, actions: { select: { status: true } },
        miseEnOeuvre: true, etatAvantSortie: true, horsPerimetreLe: true,
        derogationStatut: true, derogationMotif: true, derogationDemandeePar: true, derogationDecisionPar: true, derogationDecisionLe: true, derogationDecisionNote: true,
      },
    }),
  ]);

  // Documents / preuves : liés à l'objectif, à ses indicateurs, à ses actions, à ses exigences et constats.
  const docWhere: any[] = [{ linkedType: "objectif", linkedId: cycleId }];
  if (indicators.length) docWhere.push({ linkedType: "indicateur", linkedId: { in: indicators.map((i) => i.id) } });
  if (cycle.actions.length) docWhere.push({ linkedType: "action", linkedId: { in: cycle.actions.map((a) => a.id) } });
  if (requirements.length) docWhere.push({ linkedType: "exigence", linkedId: { in: requirements.map((r) => r.id) } });
  if (findings.length) docWhere.push({ linkedType: "constat", linkedId: { in: findings.map((f) => f.id) } });
  const documents = await prisma.documentRef.findMany({ where: { OR: docWhere }, select: { id: true, title: true, type: true, fileUrl: true, linkedType: true, linkedId: true, createdAt: true }, orderBy: { createdAt: "desc" } });

  const establishments = children.length
    ? await prisma.establishment.findMany({ where: { id: { in: children.map((c) => c.strategicGoal.ownerId) } }, select: { id: true, name: true } })
    : [];
  const childInds = children.length ? await indicatorViews(children.map((c) => c.id)) : [];
  const childViews = children.map((c) => {
    const p = objectiveProgress({ indicators: childInds.filter((i) => i.strategicGoalCycleId === c.id), actions: c.actions });
    const etat = c.miseEnOeuvre && isEtat(c.miseEnOeuvre) ? c.miseEnOeuvre : null;
    return {
      cycleId: c.id,
      statut: c.statut,
      establishment: establishments.find((e) => e.id === c.strategicGoal.ownerId) || null,
      progress: p,
      // Déclinaison (P1) : état déclaré (null = non encore renseigné), dérogation, hors périmètre, changements du groupe à examiner.
      etat,
      etatLabel: etat ? ETAT_LABELS[etat] : "État non renseigné",
      etatAvantSortie: c.etatAvantSortie,
      horsPerimetreLe: c.horsPerimetreLe,
      derogation: c.derogationStatut
        ? { statut: c.derogationStatut, motif: c.derogationMotif, demandeePar: c.derogationDemandeePar, decisionPar: c.derogationDecisionPar, decisionLe: c.derogationDecisionLe, decisionNote: c.derogationDecisionNote }
        : null,
      changesPending: pendingChanges(sourceChanges, reviewsByChild.get(c.id) || [], c.createdAt).length,
    };
  });
  const etatCounts: Record<string, number> = {};
  for (const v of childViews) etatCounts[v.etat || "non_renseigne"] = (etatCounts[v.etat || "non_renseigne"] || 0) + 1;
  const derogationsPending = childViews.filter((v) => v.derogation && v.derogation.statut === "demandee").length;

  // Côté groupe : mode de diffusion, destinataires et établissements du groupe (pour le sélecteur et les « non diffusés »).
  let diffusionInfo: { mode: string; targetIds: string[]; establishments: { id: string; name: string }[] } | null = null;
  if (!cycle.parentCycleId && cycle.strategicGoal.ownerType === "groupe") {
    const [targets, groupEsts] = await Promise.all([
      prisma.goalDiffusionTarget.findMany({ where: { strategicGoalCycleId: cycleId }, select: { establishmentId: true } }),
      prisma.establishment.findMany({ where: { groupId: cycle.strategicGoal.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    diffusionInfo = { mode: cycle.diffusion, targetIds: targets.map((t) => t.establishmentId), establishments: groupEsts };
  }

  // Côté déclinaison : changements du groupe encore à examiner.
  const pending = cycle.parentCycleId ? await listPendingChanges(cycleId) : [];
  const changesToReview = pending.map((c) => ({
    id: c.id,
    createdAt: c.createdAt,
    auteur: c.auteur,
    changes: c.changes as unknown as Record<string, FieldChange>,
    toApply: fieldsToApply(c.changes as unknown as Record<string, FieldChange>),
  }));

  return {
    cycle,
    indicators,
    progress: objectiveProgress({ indicators, actions: cycle.actions }),
    risks,
    decisions,
    findings,
    requirements,
    documents,
    children: childViews,
    etatCounts,
    derogationsPending,
    diffusionInfo,
    changesToReview,
    rollup: children.length ? rollupProgress(childViews.map((c) => ({ percent: c.progress.percent }))) : null,
  };
}

// --- Liens transversaux (aucun doublon : on relie des objets existants) ------------------------------------------

type OwnerRef = { ownerType: string; ownerId: string | null };

async function inScope(target: OwnerRef, goalOwner: { ownerType: string; ownerId: string }): Promise<boolean> {
  if (!target.ownerId) return false;
  if (target.ownerType === goalOwner.ownerType && target.ownerId === goalOwner.ownerId) return true;
  if (goalOwner.ownerType !== "groupe") return false;
  // Un objectif de groupe peut relier ce qui appartient à son périmètre : ses établissements et ses initiatives.
  if (target.ownerType === "etablissement") {
    const est = await prisma.establishment.findUnique({ where: { id: target.ownerId }, select: { groupId: true } });
    return est?.groupId === goalOwner.ownerId;
  }
  if (target.ownerType === "initiative") {
    const ini = await prisma.initiative.findUnique({ where: { id: target.ownerId }, select: { groupId: true } });
    return ini?.groupId === goalOwner.ownerId;
  }
  return false;
}

export async function addObjectiveLink(cycleId: string, kind: LinkKind, targetId: string, nature: string): Promise<Result> {
  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: cycleId }, include: { strategicGoal: { select: { ownerType: true, ownerId: true } } } });
  if (!cycle) return { ok: false, status: 404, error: "Objectif introuvable." };
  const goalOwner = cycle.strategicGoal;

  let target: OwnerRef | null = null;
  const data: any = { strategicGoalCycleId: cycleId, nature };
  if (kind === "risque") {
    const r = await prisma.risk.findUnique({ where: { id: targetId }, select: { ownerType: true, ownerId: true, initiativeId: true } });
    target = r ? { ownerType: r.ownerType, ownerId: r.ownerId || r.initiativeId } : null;
    data.riskId = targetId;
  } else if (kind === "decision") {
    const d = await prisma.decision.findUnique({ where: { id: targetId }, select: { ownerType: true, ownerId: true, initiativeId: true } });
    target = d ? { ownerType: d.ownerType, ownerId: d.ownerId || d.initiativeId } : null;
    data.decisionId = targetId;
  } else if (kind === "constat") {
    const f = await prisma.auditFinding.findUnique({ where: { id: targetId }, select: { ownerType: true, ownerId: true } });
    target = f ? { ownerType: f.ownerType, ownerId: f.ownerId } : null;
    data.auditFindingId = targetId;
  } else {
    const q = await prisma.qualityRequirement.findUnique({ where: { id: targetId }, select: { ownerType: true, ownerId: true } });
    target = q ? { ownerType: q.ownerType, ownerId: q.ownerId } : null;
    data.qualityRequirementId = targetId;
  }
  if (!target) return { ok: false, status: 404, error: "Élément à relier introuvable." };
  if (!(await inScope(target, goalOwner))) return { ok: false, status: 400, error: "Cet élément n'appartient pas au périmètre de l'objectif (même groupe ou établissement)." };

  try {
    const created = await prisma.strategicGoalLink.create({ data });
    return { ok: true, id: created.id };
  } catch (e: any) {
    if (e?.code === "P2002") return { ok: false, status: 409, error: "Cet élément est déjà relié à l'objectif." };
    throw e;
  }
}

// --- Migration des données existantes (additive, idempotente, sans suppression) -----------------------------------

export interface ObjectifsMigrationSummary {
  dryRun: boolean;
  before: Record<string, number>;
  after: Record<string, number> | null;
  parentCyclesLinked: number;
  parentCyclesUnresolved: { cycleId: string }[];
  diffusionFlagged: number;
  resultatAttenduFilled: number;
  preservedCountsIdentical: boolean | null;
}

async function counts(): Promise<Record<string, number>> {
  const [plans, goals, cycles, contributions, actions, requirements, findings, indicators] = await Promise.all([
    prisma.strategicPlan.count(),
    prisma.strategicGoal.count(),
    prisma.strategicGoalCycle.count(),
    prisma.initiativeGoalContribution.count(),
    prisma.action.count(),
    prisma.qualityRequirement.count(),
    prisma.auditFinding.count(),
    prisma.goalIndicator.count(),
  ]);
  return { plans, goals, cycles, contributions, actions, requirements, findings, indicators };
}

// 1) rattache chaque déclinaison d'établissement existante à son cycle de groupe (lien explicite, jamais deviné) ;
// 2) marque « tous » les cycles de groupe déjà diffusés (comportement actuel) ;
// 3) recopie l'ancienne « cible » texte dans « résultat attendu » si celui-ci est vide (l'ancien texte est conservé).
// Aucun indicateur n'est créé à partir des anciens textes : une progression ne doit jamais être fabriquée.
export async function migrateObjectifs(opts: { dryRun?: boolean } = {}): Promise<ObjectifsMigrationSummary> {
  const dryRun = !!opts.dryRun;
  const before = await counts();
  const summary: ObjectifsMigrationSummary = {
    dryRun,
    before,
    after: null,
    parentCyclesLinked: 0,
    parentCyclesUnresolved: [],
    diffusionFlagged: 0,
    resultatAttenduFilled: 0,
    preservedCountsIdentical: null,
  };

  // 1) liens explicites
  const children = await prisma.strategicGoalCycle.findMany({
    where: { parentCycleId: null, strategicGoal: { parentGoalId: { not: null } }, strategicPlan: { parentPlanId: { not: null } } },
    select: { id: true, strategicGoal: { select: { parentGoalId: true } }, strategicPlan: { select: { parentPlanId: true } } },
  });
  if (children.length > 0) {
    const goalIds = Array.from(new Set(children.map((c) => c.strategicGoal.parentGoalId as string)));
    const planIds = Array.from(new Set(children.map((c) => c.strategicPlan.parentPlanId as string)));
    const groupCycles = await prisma.strategicGoalCycle.findMany({
      where: { strategicGoalId: { in: goalIds }, strategicPlanId: { in: planIds } },
      select: { id: true, strategicGoalId: true, strategicPlanId: true },
    });
    const pool = groupCycles.map((c) => ({ id: c.id, goalId: c.strategicGoalId, planId: c.strategicPlanId }));
    for (const ch of children) {
      const parentId = resolveParentCycleId({ goalParentId: ch.strategicGoal.parentGoalId, planParentId: ch.strategicPlan.parentPlanId }, pool);
      if (!parentId) {
        summary.parentCyclesUnresolved.push({ cycleId: ch.id });
        continue;
      }
      if (!dryRun) await prisma.strategicGoalCycle.update({ where: { id: ch.id }, data: { parentCycleId: parentId } });
      summary.parentCyclesLinked++;
    }
  }

  // 2) portée « tous » des cycles de groupe déjà diffusés
  const diffused = await prisma.strategicGoalCycle.findMany({
    where: { diffusion: "aucune", strategicGoal: { ownerType: "groupe", diffuse: true }, strategicPlan: { diffuse: true } },
    select: { id: true },
  });
  summary.diffusionFlagged = diffused.length;
  if (!dryRun && diffused.length > 0) {
    await prisma.strategicGoalCycle.updateMany({ where: { id: { in: diffused.map((c) => c.id) } }, data: { diffusion: "tous" } });
  }

  // 3) ancienne cible texte → résultat attendu (si vide)
  const legacy = await prisma.strategicGoalCycle.findMany({ where: { resultatAttendu: null, cible: { not: null } }, select: { id: true, cible: true } });
  const withText = legacy.filter((c) => (c.cible || "").trim().length > 0);
  summary.resultatAttenduFilled = withText.length;
  if (!dryRun) {
    for (const c of withText) await prisma.strategicGoalCycle.update({ where: { id: c.id }, data: { resultatAttendu: c.cible } });
    summary.after = await counts();
    summary.preservedCountsIdentical = (["plans", "goals", "cycles", "contributions", "actions", "requirements", "findings"] as const).every((k) => before[k] === (summary.after as Record<string, number>)[k]);
  }
  return summary;
}

// --- Lot 2 : candidats à l'association, documents, historique ---------------------------------------------------------

export interface Candidate {
  id: string;
  label: string;
  sub?: string;
}

// Éléments existants que l'on peut relier à un objectif (même périmètre, pas déjà reliés) : aucun doublon.
export async function loadLinkCandidates(
  scope: { ownerType: string; ownerId: string },
  already: { risks: string[]; decisions: string[]; findings: string[]; requirements: string[] }
) {
  let groupId: string | null = null;
  let establishmentIds: string[] = [];
  if (scope.ownerType === "groupe") {
    groupId = scope.ownerId;
    establishmentIds = (await prisma.establishment.findMany({ where: { groupId }, select: { id: true } })).map((e) => e.id);
  }
  const ownerOr = (extra: any[] = []) =>
    scope.ownerType === "groupe"
      ? [{ ownerType: "groupe", ownerId: scope.ownerId }, { ownerType: "etablissement", ownerId: { in: establishmentIds } }, ...extra]
      : [{ ownerType: scope.ownerType, ownerId: scope.ownerId }];
  const initiativeOr = scope.ownerType === "groupe" ? [{ initiative: { groupId } }] : [];

  const [risks, decisions, findings, requirements] = await Promise.all([
    prisma.risk.findMany({ where: { id: { notIn: already.risks }, OR: ownerOr(initiativeOr) }, select: { id: true, description: true, criticite: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.decision.findMany({ where: { id: { notIn: already.decisions }, OR: ownerOr(initiativeOr) }, select: { id: true, subject: true, status: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.auditFinding.findMany({ where: { id: { notIn: already.findings }, OR: ownerOr() }, select: { id: true, libelle: true, type: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.qualityRequirement.findMany({ where: { id: { notIn: already.requirements }, OR: ownerOr() }, select: { id: true, code: true, libelle: true, referentiel: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return {
    risques: risks.map((r): Candidate => ({ id: r.id, label: r.description, sub: r.criticite })),
    decisions: decisions.map((d): Candidate => ({ id: d.id, label: d.subject, sub: d.status })),
    constats: findings.map((f): Candidate => ({ id: f.id, label: f.libelle, sub: f.type })),
    exigences: requirements.map((q): Candidate => ({ id: q.id, label: `${q.code ? q.code + " · " : ""}${q.libelle}`, sub: q.referentiel || undefined })),
  };
}

// Documents du même périmètre, non encore rattachés à un élément : candidats « preuve de l'objectif ».
export async function loadDocumentCandidates(scope: { ownerType: string; ownerId: string }): Promise<Candidate[]> {
  const docs = await prisma.documentRef.findMany({
    where: { ownerType: scope.ownerType, ownerId: scope.ownerId, linkedType: null },
    select: { id: true, title: true, type: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return docs.map((d) => ({ id: d.id, label: d.title, sub: d.type || undefined }));
}

// Initiatives du groupe qui ne contribuent pas encore à l'objectif.
export async function loadInitiativeCandidates(groupId: string, contributingIds: string[]): Promise<Candidate[]> {
  const rows = await prisma.initiative.findMany({
    where: { groupId, id: { notIn: contributingIds } },
    select: { id: true, name: true, reference: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return rows.map((i) => ({ id: i.id, label: i.name, sub: i.reference || undefined }));
}

// Historique : événements de l'objectif lui-même et de ses actions.
export async function loadObjectiveHistory(cycleId: string, actionIds: string[]) {
  return prisma.auditLog.findMany({
    where: { OR: [{ entityType: "objectif", entityId: cycleId }, ...(actionIds.length ? [{ entityType: "action", entityId: { in: actionIds } }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}
