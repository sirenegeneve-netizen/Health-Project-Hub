import { prisma } from "@/lib/db";
import { syncGroupDiffusion, syncIndicatorsToChildren } from "@/lib/diffusionDb";
import {
  currentValue,
  effectiveIndicator,
  formatTarget,
  indicatorProgress,
  objectiveProgress,
  rollupProgress,
  resolveParentCycleId,
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
          perimetre: body.perimetre ? String(body.perimetre) : null,
          echeance: toDate(body.echeance),
          diffusion: diffuse ? "tous" : "aucune",
        },
      });

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
          },
        });
        createdIndicators.push(created);
        const actuelle = toNumberOrNull(ind.valeurActuelle);
        if (actuelle !== null) {
          await tx.goalIndicatorMeasure.create({ data: { goalIndicatorId: created.id, valeur: actuelle, dateMesure: new Date(), source: "création de l'objectif" } });
        }
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
    data: { nom: parent.nom, description: parent.description, unite: parent.unite, sens: parent.sens, frequence: parent.frequence },
  });
  return res.count;
}

// --- Synthèse (liste) et détail (fiche) ---------------------------------------------------------------------------

async function indicatorViews(cycleIds: string[]) {
  const indicators = await prisma.goalIndicator.findMany({
    where: { strategicGoalCycleId: { in: cycleIds } },
    include: { measures: { select: { id: true, valeur: true, dateMesure: true, createdAt: true, commentaire: true }, orderBy: { dateMesure: "desc" } } },
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
    prisma.strategicGoalCycle.findMany({ where: { parentCycleId: cycleId }, select: { id: true, statut: true, strategicGoal: { select: { ownerId: true } }, actions: { select: { status: true } } } }),
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
    return { cycleId: c.id, statut: c.statut, establishment: establishments.find((e) => e.id === c.strategicGoal.ownerId) || null, progress: p };
  });

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
