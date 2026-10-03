import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_STAGES, type WorkflowStageDef } from "@/lib/lifecycle";
import { ensureStageCriteria, CRITERIA_STAGES, type CriteriaStageKey } from "@/lib/stageCriteria";
import {
  PROJECT_TYPES,
  STAGE_LIBRARY,
  buildGeneralTemplateSpec,
  buildTemplateSpec,
  type LegacyCriteria,
  type TemplateSpec,
} from "@/lib/templateSeedData";
import { planInstance, templateOptionsForType, type PlanStageIn, type TemplateLite } from "@/lib/templatePlan";

// Moteur de modèles de projet (Lot 1) — accès base de données.
// Principe : tout est additif. Une initiative sans `templateId` continue de
// fonctionner exactement comme avant (repli sur WorkflowStage / DEFAULT_STAGES).

export type Db = Prisma.TransactionClient;

// --- Lecture des étapes d'une initiative (copie figée, sinon repli historique) --------

function toDef(r: { key: string; label: string; legacyPhases: string[] }): WorkflowStageDef {
  return { key: r.key, label: r.label, legacyPhases: r.legacyPhases };
}

async function legacyStagesForType(type: string): Promise<WorkflowStageDef[]> {
  const rows = await prisma.workflowStage.findMany({ where: { initiativeType: type }, orderBy: { ordre: "asc" } });
  return rows.length === 0 ? DEFAULT_STAGES : rows.map(toDef);
}

export async function getInitiativeStages(initiativeId: string, type: string): Promise<WorkflowStageDef[]> {
  const rows = await prisma.initiativeStage.findMany({ where: { initiativeId, active: true }, orderBy: { position: "asc" } });
  if (rows.length > 0) return rows.map(toDef);
  return legacyStagesForType(type);
}

// Variante pour les listes : une requête pour toutes les initiatives affichées.
export async function getInitiativeStagesMap(initiatives: { id: string; type: string }[]): Promise<Map<string, WorkflowStageDef[]>> {
  const result = new Map<string, WorkflowStageDef[]>();
  if (initiatives.length === 0) return result;
  const rows = await prisma.initiativeStage.findMany({
    where: { initiativeId: { in: initiatives.map((i) => i.id) }, active: true },
    orderBy: { position: "asc" },
  });
  const byInitiative = new Map<string, WorkflowStageDef[]>();
  for (const r of rows) {
    const list = byInitiative.get(r.initiativeId) ?? [];
    list.push(toDef(r));
    byInitiative.set(r.initiativeId, list);
  }
  const legacyRows = await prisma.workflowStage.findMany({ orderBy: { ordre: "asc" } });
  const legacyByType: Record<string, WorkflowStageDef[]> = {};
  for (const r of legacyRows) (legacyByType[r.initiativeType] ??= []).push(toDef(r));
  for (const i of initiatives) {
    const own = byInitiative.get(i.id);
    result.set(i.id, own?.length ? own : legacyByType[i.type]?.length ? legacyByType[i.type] : DEFAULT_STAGES);
  }
  return result;
}

// --- Choix du modèle à la création --------------------------------------------------

export async function getTemplateChoices(typeKey: string) {
  const all = await prisma.projectTemplate.findMany({
    select: { id: true, typeKey: true, familyId: true, name: true, version: true, status: true, isGeneral: true },
  });
  return templateOptionsForType(all as TemplateLite[], typeKey);
}

// Résout le modèle à appliquer : choix explicite valide, sinon sélection automatique, sinon
// Modèle général, sinon aucun (l'initiative reste alors sur le fonctionnement historique).
export async function resolveTemplateForCreation(typeKey: string, requestedId?: string | null): Promise<string | null> {
  const choices = await getTemplateChoices(typeKey);
  if (requestedId) {
    const ok = choices.options.some((o) => o.id === requestedId) || choices.fallbackGeneralId === requestedId;
    if (ok) return requestedId;
  }
  return choices.autoSelectedId ?? choices.options[0]?.id ?? choices.fallbackGeneralId ?? null;
}

// --- Instanciation : copie figée du parcours à la création ---------------------------

export async function instantiateTemplate(tx: Db, initiativeId: string, templateId: string): Promise<{ firstPhase: string | null; stages: number }> {
  const stages = await tx.templateStage.findMany({
    where: { templateId },
    include: { criteria: true },
    orderBy: { position: "asc" },
  });
  const input: PlanStageIn[] = stages.map((s) => ({
    id: s.id,
    position: s.position,
    key: s.key,
    label: s.label,
    objectif: s.objectif,
    obligatoire: s.obligatoire,
    active: s.active,
    legacyPhases: s.legacyPhases,
    gateMode: s.gateMode,
    criteria: s.criteria.map((c) => ({ label: c.label, order: c.order, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })),
  }));
  const plan = planInstance(input);
  for (const s of plan.stages) {
    const created = await tx.initiativeStage.create({
      data: {
        initiativeId,
        templateStageId: s.templateStageId,
        key: s.key,
        label: s.label,
        objectif: s.objectif,
        position: s.position,
        obligatoire: s.obligatoire,
        active: true,
        legacyPhases: s.legacyPhases,
        gateMode: s.gateMode,
      },
    });
    if (s.criteria.length > 0) {
      await tx.stageCriterion.createMany({
        data: s.criteria.map((c) => ({
          initiativeId,
          stageKey: s.key,
          label: c.label,
          order: c.order,
          obligatoire: c.obligatoire,
          mode: c.mode,
          autoSource: c.autoSource,
          initiativeStageId: created.id,
        })),
        skipDuplicates: true,
      });
    }
  }
  return { firstPhase: plan.firstPhase, stages: plan.stages.length };
}

// --- Seed idempotent (types, bibliothèque, modèles standards, modèle général) ---------

export async function loadLegacyCriteria(db: Db = prisma): Promise<LegacyCriteria> {
  const rows = await db.stageCriterionTemplate.findMany({ orderBy: { order: "asc" } });
  const legacy: LegacyCriteria = {};
  for (const r of rows) {
    ((legacy[r.initiativeType] ??= {})[r.stageKey] ??= []).push(r.label);
  }
  return legacy;
}

async function createTemplateFromSpec(db: Db, spec: TemplateSpec, status: string) {
  return db.projectTemplate.create({
    data: {
      typeKey: spec.typeKey,
      familyId: spec.familyId,
      name: spec.name,
      version: 1,
      status,
      isGeneral: spec.isGeneral,
      stages: {
        create: spec.stages.map((s, position) => ({
          position,
          key: s.key,
          label: s.label,
          stageDefKey: s.key,
          objectif: s.objectif,
          obligatoire: s.obligatoire,
          active: true,
          legacyPhases: s.legacyPhases,
          criteria: {
            create: s.criteria.map((c, order) => ({ label: c.label, order, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })),
          },
        })),
      },
    },
  });
}

export interface SeedSummary {
  types: number;
  stageDefinitions: number;
  templatesCreated: number;
  templatesAlreadyPresent: number;
}

export async function seedTemplateEngine(db: Db = prisma): Promise<SeedSummary> {
  const types = await db.projectType.createMany({
    data: PROJECT_TYPES.map((t, ordre) => ({ key: t.key, label: t.label, family: t.family, ordre, system: true })),
    skipDuplicates: true,
  });
  const defs = await db.stageDefinition.createMany({
    data: Object.entries(STAGE_LIBRARY).map(([key, s]) => ({ key, label: s.label, objectif: s.objectif, system: true })),
    skipDuplicates: true,
  });

  const legacy = await loadLegacyCriteria(db);
  let created = 0;
  let present = 0;
  const specs: TemplateSpec[] = [buildGeneralTemplateSpec(legacy), ...PROJECT_TYPES.map((t) => buildTemplateSpec(t.key, legacy))];
  for (const spec of specs) {
    const exists = await db.projectTemplate.count({ where: { familyId: spec.familyId } });
    if (exists > 0) {
      present++;
      continue;
    }
    await createTemplateFromSpec(db, spec, "actif");
    created++;
  }
  return { types: types.count, stageDefinitions: defs.count, templatesCreated: created, templatesAlreadyPresent: present };
}

// --- Migration des initiatives existantes (sans rien supprimer ni modifier) -----------

export interface MigrationSummary {
  dryRun: boolean;
  initiativesTotal: number;
  alreadyMigrated: number;
  migrated: number;
  withoutTemplate: number;
  stagesCreated: number;
  criteriaLinked: number;
  criteriaMaterialized: number;
  phaseUnresolved: { initiativeId: string; phase: string }[];
}

export async function migrateExistingInitiatives(opts: { dryRun?: boolean; limit?: number } = {}): Promise<MigrationSummary> {
  const dryRun = !!opts.dryRun;
  const initiatives = await prisma.initiative.findMany({ select: { id: true, type: true, phase: true, templateId: true } });
  const summary: MigrationSummary = {
    dryRun,
    initiativesTotal: initiatives.length,
    alreadyMigrated: initiatives.filter((i) => i.templateId).length,
    migrated: 0,
    withoutTemplate: 0,
    stagesCreated: 0,
    criteriaLinked: 0,
    criteriaMaterialized: 0,
    phaseUnresolved: [],
  };

  const todo = initiatives.filter((i) => !i.templateId).slice(0, opts.limit ?? 200);
  const templates = await prisma.projectTemplate.findMany({
    where: { OR: [{ isGeneral: true }, { familyId: { startsWith: "std-" } }] },
    include: { stages: true },
    orderBy: { version: "desc" },
  });
  const templateFor = (type: string) => templates.find((t) => t.familyId === `std-${type}`) ?? templates.find((t) => t.isGeneral);

  for (const ini of todo) {
    const template = templateFor(ini.type);
    if (!template) {
      summary.withoutTemplate++;
      continue;
    }
    const legacyStages = await legacyStagesForType(ini.type);
    if (!legacyStages.some((s) => s.key === ini.phase || s.legacyPhases.includes(ini.phase))) {
      summary.phaseUnresolved.push({ initiativeId: ini.id, phase: ini.phase });
    }
    if (dryRun) {
      summary.migrated++;
      summary.stagesCreated += legacyStages.length;
      continue;
    }

    const rows = legacyStages.map((s, position) => {
      const tStage = template.stages.find((ts) => ts.key === s.key);
      return {
        initiativeId: ini.id,
        templateStageId: tStage?.id ?? null,
        key: s.key,
        label: s.label,
        objectif: tStage?.objectif ?? STAGE_LIBRARY[s.key]?.objectif ?? null,
        position,
        obligatoire: true,
        active: true,
        legacyPhases: s.legacyPhases,
        gateMode: null,
      };
    });
    const res = await prisma.initiativeStage.createMany({ data: rows, skipDuplicates: true });
    summary.stagesCreated += res.count;

    // Même matérialisation que celle qu'aurait faite la première visite de la page (idempotent).
    for (const s of legacyStages) {
      if ((CRITERIA_STAGES as readonly string[]).includes(s.key)) {
        const before = await prisma.stageCriterion.count({ where: { initiativeId: ini.id, stageKey: s.key } });
        await ensureStageCriteria(ini.id, s.key as CriteriaStageKey, ini.type);
        const after = await prisma.stageCriterion.count({ where: { initiativeId: ini.id, stageKey: s.key } });
        summary.criteriaMaterialized += after - before;
      }
    }

    const stored = await prisma.initiativeStage.findMany({ where: { initiativeId: ini.id }, select: { id: true, key: true } });
    for (const st of stored) {
      const linked = await prisma.stageCriterion.updateMany({
        where: { initiativeId: ini.id, stageKey: st.key, initiativeStageId: null },
        data: { initiativeStageId: st.id },
      });
      summary.criteriaLinked += linked.count;
    }

    // En dernier : si une étape plante, l'initiative reste « non migrée » et sera reprise à la prochaine exécution.
    await prisma.initiative.update({ where: { id: ini.id }, data: { templateId: template.id } });
    summary.migrated++;
  }
  return summary;
}

// --- Duplication / nouvelle version -------------------------------------------------

// Copie profonde d'un modèle (étapes, critères, éléments attendus).
//  - nouvelle version : même famille, version + 1, brouillon (l'ancienne reste telle quelle) ;
//  - duplication : nouvelle famille, version 1, rattachée éventuellement à un autre type.
export async function cloneTemplate(
  db: Db,
  sourceId: string,
  opts: { mode: "new_version" | "duplicate"; name?: string; typeKey?: string; status?: string }
) {
  const src = await db.projectTemplate.findUnique({
    where: { id: sourceId },
    include: { stages: { include: { criteria: true, items: true }, orderBy: { position: "asc" } } },
  });
  if (!src) return null;

  let familyId = src.familyId;
  let version = 1;
  if (opts.mode === "new_version") {
    const versions = await db.projectTemplate.findMany({ where: { familyId: src.familyId }, select: { version: true } });
    version = Math.max(...versions.map((v) => v.version)) + 1;
  } else {
    familyId = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return db.projectTemplate.create({
    data: {
      typeKey: opts.typeKey ?? src.typeKey,
      familyId,
      name: opts.name ?? src.name,
      description: src.description,
      version,
      status: opts.status ?? "brouillon",
      isGeneral: false,
      parentTemplateId: opts.mode === "duplicate" ? src.id : src.parentTemplateId,
      stages: {
        create: src.stages.map((s) => ({
          position: s.position,
          key: s.key,
          label: s.label,
          stageDefKey: s.stageDefKey,
          description: s.description,
          objectif: s.objectif,
          obligatoire: s.obligatoire,
          active: s.active,
          legacyPhases: s.legacyPhases,
          gateMode: s.gateMode,
          criteria: { create: s.criteria.map((c) => ({ label: c.label, order: c.order, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })) },
          items: { create: s.items.map((it) => ({ kind: it.kind, label: it.label, order: it.order, obligatoire: it.obligatoire })) },
        })),
      },
    },
  });
}

// Active une version : elle devient la seule version active de sa famille (les autres sont archivées,
// les initiatives déjà créées restent rattachées à leur version).
export async function activateTemplate(db: Db, templateId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await db.projectTemplate.findUnique({ where: { id: templateId }, include: { stages: true } });
  if (!t) return { ok: false, error: "Modèle introuvable." };
  if (!t.stages.some((s) => s.active)) return { ok: false, error: "Un modèle doit contenir au moins une étape active pour être activé." };
  await db.projectTemplate.updateMany({ where: { familyId: t.familyId, status: "actif", id: { not: t.id } }, data: { status: "archive" } });
  await db.projectTemplate.update({ where: { id: t.id }, data: { status: "actif" } });
  return { ok: true };
}
