import { Prisma, type GoalIndicator } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit, truncateLabel } from "@/lib/audit";
import {
  GLOBAL_SCOPE, correctiveActionDraft, isBaselineAction, sanitizeContenu, sanitizeMeasures, scopeKeyOf,
  validateAuditForValidation, canSuggestClosure, consolidateAudits, emptyContenu,
  type AuditContenu, type AuditMeasureInput,
} from "@/lib/baselineAudit";

type User = { id: string; name: string };
// Résultat simple (volontairement pas une union discriminée : le projet est en `strict: false`, où `if (!res.ok)` ne
// rétrécirait pas le type et ferait échouer le build).
export interface Result<T> {
  ok: boolean;
  data?: T;
  status?: number;
  error?: string;
  errors?: string[];
}
const fail = <T = never>(status: number, error: string, errors?: string[]): Result<T> => ({ ok: false, status, error, errors });

const asContenu = (raw: unknown): AuditContenu => ({ ...emptyContenu(), ...sanitizeContenu(raw, raw as Partial<AuditContenu>) });

interface ChildCycle {
  id: string;
  strategicGoal: { ownerId: string };
  indicators: { id: string; parentIndicatorId: string | null }[];
}

// Contexte d'un audit de départ : l'action, l'objectif, les indicateurs à évaluer, les établissements possibles.
async function loadContext(actionId: string) {
  const action = await prisma.action.findUnique({ where: { id: actionId }, include: { responsableActor: { select: { id: true, name: true } } } });
  if (!action) return null;
  const noCtx = { action, cycle: null, indicators: [] as GoalIndicator[], establishments: [] as { id: string; name: string }[], childCycles: [] as ChildCycle[] };
  if (!isBaselineAction(action)) return noCtx;
  const cycle = action.strategicGoalCycleId
    ? await prisma.strategicGoalCycle.findUnique({
        where: { id: action.strategicGoalCycleId },
        include: { strategicGoal: true, scopeEstablishments: { include: { establishment: { select: { id: true, name: true } } } } },
      })
    : null;
  if (!cycle) return noCtx;
  const orConditions: Prisma.GoalIndicatorWhereInput[] = [{ baselineActionId: action.id }];
  if (action.indicatorId) orConditions.push({ id: action.indicatorId });
  const indicators = await prisma.goalIndicator.findMany({ where: { strategicGoalCycleId: cycle.id, OR: orConditions }, orderBy: { createdAt: "asc" } });
  const childCycles: ChildCycle[] =
    cycle.strategicGoal.ownerType === "groupe"
      ? await prisma.strategicGoalCycle.findMany({ where: { parentCycleId: cycle.id }, include: { strategicGoal: { select: { ownerId: true } }, indicators: { select: { id: true, parentIndicatorId: true } } } })
      : [];
  let establishments: { id: string; name: string }[] = [];
  if (cycle.strategicGoal.ownerType === "groupe") {
    const ids = cycle.scopeEstablishments.length > 0 ? cycle.scopeEstablishments.map((s) => s.establishmentId) : childCycles.map((c) => c.strategicGoal.ownerId);
    establishments = ids.length ? await prisma.establishment.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  }
  return { action, cycle, indicators, establishments, childCycles };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

// Où vit réellement le résultat d'un audit : l'objectif du groupe (périmètre global) ou la copie de l'établissement.
function resolveTarget(ctx: Ctx, establishmentId: string | null) {
  const cycle = ctx.cycle!;
  const child = establishmentId ? ctx.childCycles.find((c) => c.strategicGoal.ownerId === establishmentId) || null : null;
  const indicatorFor = (groupIndicatorId: string): string | null => {
    if (!establishmentId) return groupIndicatorId;
    return child?.indicators.find((i) => i.parentIndicatorId === groupIndicatorId)?.id ?? null;
  };
  return {
    ownerType: establishmentId ? "etablissement" : cycle.strategicGoal.ownerType,
    ownerId: establishmentId ?? cycle.strategicGoal.ownerId,
    establishmentId: establishmentId ?? (cycle.strategicGoal.ownerType === "etablissement" ? cycle.strategicGoal.ownerId : null),
    primaryCycleId: child ? child.id : cycle.id,
    linkCycleIds: Array.from(new Set([cycle.id, ...(child ? [child.id] : [])])),
    indicatorFor,
  };
}

export function expectedScopeKeys(ctx: { establishments: { id: string }[] }): string[] {
  return ctx.establishments.length > 0 ? ctx.establishments.map((e) => e.id) : [GLOBAL_SCOPE];
}

// --- Lecture pour la page ----------------------------------------------------------------------------------------------

export type AuditPageData = Extract<Awaited<ReturnType<typeof loadAuditPageData>>, { kind: "ok" }>;

export async function loadAuditPageData(actionId: string, scopeKeyWanted?: string) {
  const ctx = await loadContext(actionId);
  if (!ctx) return { kind: "missing" as const };
  if (!ctx.cycle) return { kind: "not_baseline" as const, action: ctx.action };
  const action = ctx.action;
  const cycle = ctx.cycle;
  const audits = await prisma.baselineAudit.findMany({ where: { actionId }, include: { measures: true } });
  const expected = expectedScopeKeys(ctx);
  const scopeKey = scopeKeyWanted && (scopeKeyWanted === GLOBAL_SCOPE || ctx.establishments.some((e) => e.id === scopeKeyWanted)) ? scopeKeyWanted : expected[0];
  const audit = audits.find((a) => a.scopeKey === scopeKey) || null;
  const establishmentId = scopeKey === GLOBAL_SCOPE ? null : scopeKey;
  const target = resolveTarget(ctx, establishmentId);

  // Valeur initiale en vigueur de chaque indicateur, dans le périmètre audité (copie de l'établissement le cas échéant).
  const indicatorIdsInScope = ctx.indicators.map((i) => target.indicatorFor(i.id)).filter((x): x is string => !!x);
  const scoped = indicatorIdsInScope.length ? await prisma.goalIndicator.findMany({ where: { id: { in: indicatorIdsInScope } }, select: { id: true, valeurInitiale: true } }) : [];
  const indicators = ctx.indicators.map((i) => {
    const sid = target.indicatorFor(i.id);
    const eff = scoped.find((s) => s.id === sid);
    return { id: i.id, nom: i.nom, unite: i.unite, valeurCible: i.valeurCible, sens: i.sens, theme: i.theme, applicable: sid !== null, valeurInitiale: eff ? eff.valeurInitiale : null };
  });

  const findings = audit?.statut === "valide" && audit.contenu ? await prisma.auditFinding.findMany({ where: { baselineAuditId: audit.id }, include: { actions: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: "asc" } }) : [];
  const consolidation = ctx.establishments.length > 0 ? consolidateAudits(ctx.establishments, audits.map((a) => ({ establishmentId: a.establishmentId, statut: a.statut, measures: a.measures }))) : null;

  return {
    kind: "ok" as const,
    action: {
      id: action.id, title: action.title, status: action.status, echeance: action.echeance ? action.echeance.toISOString() : null,
      responsable: action.responsableActor?.name || action.responsable || null, description: action.comments, livrable: action.livrable,
    },
    objective: {
      cycleId: cycle.id, libelle: cycle.strategicGoal.libelle, description: cycle.strategicGoal.description, cible: cycle.cible, axe: cycle.axe,
      resultatAttendu: cycle.resultatAttendu, ownerType: cycle.strategicGoal.ownerType, ownerId: cycle.strategicGoal.ownerId,
      perimetreOrg: cycle.perimetreOrg, populations: cycle.populations, perimetre: cycle.perimetre,
      scopeEstablishments: cycle.scopeEstablishments.map((s) => s.establishment.name),
    },
    establishments: ctx.establishments,
    scopeKey,
    indicators,
    audit: audit
      ? {
          id: audit.id, statut: audit.statut, dateRealisation: audit.dateRealisation ? audit.dateRealisation.toISOString().slice(0, 10) : "",
          auditeur: audit.auditeur || "", contenu: asContenu(audit.contenu), valideLe: audit.valideLe ? audit.valideLe.toISOString() : null, validePar: audit.validePar,
          measures: audit.measures.map((m) => ({
            goalIndicatorId: m.goalIndicatorId, resultat: m.resultat, valeur: m.valeur, dateReference: m.dateReference ? m.dateReference.toISOString().slice(0, 10) : "",
            methodeCalcul: m.methodeCalcul || "", source: m.source || "", commentaire: m.commentaire || "",
          })),
        }
      : null,
    findings: findings.map((f) => ({ id: f.id, type: f.type, libelle: f.libelle, statut: f.statut, actions: f.actions })),
    consolidation,
    suggestClosure: canSuggestClosure(expected, audits.map((a) => ({ scopeKey: a.scopeKey, statut: a.statut }))),
    scopeStatuses: audits.map((a) => ({ scopeKey: a.scopeKey, statut: a.statut })),
  };
}

// --- Brouillon ---------------------------------------------------------------------------------------------------------

export async function saveAuditDraft(actionId: string, body: any, user: User): Promise<Result<{ id: string }>> {
  const ctx = await loadContext(actionId);
  if (!ctx) return fail(404, "Action introuvable.");
  if (!ctx.cycle) return fail(400, "Cette action n'est pas une action d'audit de départ rattachée à un objectif.");
  const scopeKey = typeof body.scopeKey === "string" && body.scopeKey ? body.scopeKey : GLOBAL_SCOPE;
  if (scopeKey !== GLOBAL_SCOPE && !ctx.establishments.some((e) => e.id === scopeKey)) return fail(400, "Établissement hors du périmètre de l'objectif.");
  const existing = await prisma.baselineAudit.findUnique({ where: { actionId_scopeKey: { actionId, scopeKey } } });
  if (existing?.statut === "valide") return fail(409, "Cet audit est validé et verrouillé.");
  const date = body.dateRealisation ? new Date(body.dateRealisation) : null;
  if (date && Number.isNaN(date.getTime())) return fail(400, "Date de réalisation invalide.");
  const { measures, errors } = sanitizeMeasures(body.measures, ctx.indicators.map((i) => i.id));
  if (errors.length > 0) return fail(400, errors[0], errors);
  for (const m of measures) if (m.dateReference && Number.isNaN(new Date(m.dateReference).getTime())) return fail(400, "Date de référence de la mesure invalide.");
  const contenu = sanitizeContenu(body.contenu, existing ? (existing.contenu as unknown as Partial<AuditContenu>) : null);
  const establishmentId = scopeKey === GLOBAL_SCOPE ? null : scopeKey;

  const saved = await prisma.$transaction(async (tx) => {
    const audit = await tx.baselineAudit.upsert({
      where: { actionId_scopeKey: { actionId, scopeKey } },
      create: { actionId, scopeKey, establishmentId, statut: "brouillon", dateRealisation: date, auditeur: body.auditeur ? String(body.auditeur).trim() : null, contenu: contenu as unknown as Prisma.InputJsonValue },
      update: { dateRealisation: date, auditeur: body.auditeur ? String(body.auditeur).trim() : null, contenu: contenu as unknown as Prisma.InputJsonValue },
    });
    await tx.baselineAuditMeasure.deleteMany({ where: { auditId: audit.id } });
    if (measures.length > 0) {
      await tx.baselineAuditMeasure.createMany({
        data: measures.map((m) => ({
          auditId: audit.id, goalIndicatorId: m.goalIndicatorId, resultat: m.resultat, valeur: m.valeur,
          dateReference: m.dateReference ? new Date(m.dateReference) : null, methodeCalcul: m.methodeCalcul || null, source: m.source || null, commentaire: m.commentaire || null,
        })),
      });
    }
    // Commencer à documenter l'audit fait passer l'action « à faire » en « en cours » — jamais en « terminé ».
    if (ctx.action.status === "a_faire") await tx.action.update({ where: { id: actionId }, data: { status: "en_cours" } });
    return audit;
  });
  return { ok: true, data: { id: saved.id } };
}

// --- Validation --------------------------------------------------------------------------------------------------------

export async function validateAudit(auditId: string, user: User): Promise<Result<{ applied: number; notApplied: string[] }>> {
  const audit = await prisma.baselineAudit.findUnique({ where: { id: auditId }, include: { measures: true } });
  if (!audit) return fail(404, "Audit introuvable.");
  if (audit.statut === "valide") return fail(409, "Cet audit est déjà validé.");
  const ctx = await loadContext(audit.actionId);
  if (!ctx || !ctx.cycle) return fail(400, "Action ou objectif introuvable.");

  const contenu = asContenu(audit.contenu);
  const measures: AuditMeasureInput[] = audit.measures.map((m) => ({
    goalIndicatorId: m.goalIndicatorId, resultat: m.resultat as AuditMeasureInput["resultat"], valeur: m.valeur,
    dateReference: m.dateReference ? m.dateReference.toISOString() : null, methodeCalcul: m.methodeCalcul || "", source: m.source || "", commentaire: m.commentaire || "",
  }));
  const errors = validateAuditForValidation({ dateRealisation: audit.dateRealisation ? audit.dateRealisation.toISOString() : null, auditeur: audit.auditeur, contenu, measures, indicatorIds: ctx.indicators.map((i) => i.id) });
  if (errors.length > 0) return fail(400, errors[0], errors);

  const target = resolveTarget(ctx, audit.establishmentId);
  const notApplied: string[] = [];
  let applied = 0;
  const logs: { cycleId: string; label: string; indicator: string; from: number | null; to: number }[] = [];

  await prisma.$transaction(async (tx) => {
    // 1) Valeur initiale : uniquement pour les mesures « valeur mesurée », dans le périmètre audité.
    for (const m of audit.measures) {
      if (m.resultat !== "mesuree" || m.valeur === null || !m.dateReference) continue;
      const ind = ctx.indicators.find((i) => i.id === m.goalIndicatorId);
      const targetIndicatorId = target.indicatorFor(m.goalIndicatorId);
      if (!ind || !targetIndicatorId) { if (ind) notApplied.push(ind.nom); continue; }
      const current = await tx.goalIndicator.findUnique({ where: { id: targetIndicatorId }, select: { valeurInitiale: true, strategicGoalCycleId: true } });
      await tx.goalIndicatorBaseline.updateMany({ where: { goalIndicatorId: targetIndicatorId, statut: "valide" }, data: { statut: "remplace" } });
      await tx.goalIndicatorBaseline.create({
        data: {
          goalIndicatorId: targetIndicatorId, valeur: m.valeur, dateMesure: m.dateReference, source: m.source || "Audit de départ",
          justificatif: truncateLabel(`Audit de départ du ${audit.dateRealisation ? audit.dateRealisation.toLocaleDateString("fr-FR") : "—"} — ${m.methodeCalcul || m.commentaire || ""}`, 500),
          statut: "valide", auteur: audit.auditeur, validePar: user.name, valideLe: new Date(),
        },
      });
      await tx.goalIndicator.update({ where: { id: targetIndicatorId }, data: { valeurInitiale: m.valeur } });
      applied++;
      if (current) logs.push({ cycleId: current.strategicGoalCycleId, label: ctx.cycle!.strategicGoal.libelle, indicator: ind.nom, from: current.valeurInitiale, to: m.valeur });
    }

    // 2) Constats : de vrais AuditFinding, rattachés à l'objectif (et à la copie de l'établissement) et à l'audit d'origine.
    const findingIds: string[] = [];
    for (const c of contenu.constats) {
      const f = await tx.auditFinding.create({
        data: {
          ownerType: target.ownerType, ownerId: target.ownerId, type: c.type, libelle: c.libelle, description: c.description || null,
          dateConstat: audit.dateRealisation || new Date(), statut: c.type === "ecart" ? "ouvert" : "cloture", baselineAuditId: audit.id,
        },
      });
      for (const cycleId of target.linkCycleIds) await tx.strategicGoalLink.create({ data: { strategicGoalCycleId: cycleId, auditFindingId: f.id, nature: "associe" } });
      findingIds.push(f.id);
    }

    // 3) Audit verrouillé, avec la traçabilité vers les constats créés. L'action n'est PAS clôturée automatiquement.
    const finalContenu: AuditContenu = { ...contenu, findingIds, riskIds: contenu.risques.map(() => null) };
    await tx.baselineAudit.update({ where: { id: audit.id }, data: { statut: "valide", valideLe: new Date(), validePar: user.name, contenu: finalContenu as unknown as Prisma.InputJsonValue } });
  });

  for (const l of logs) {
    await logAudit({ entityType: "objectif", entityId: l.cycleId, entityLabel: truncateLabel(l.label, 120), action: "update", changes: { [`${l.indicator}.valeur_initiale`]: { from: l.from, to: `${l.to} (audit de départ validé)` } }, user });
  }
  await logAudit({ entityType: "action", entityId: ctx.action.id, entityLabel: truncateLabel(ctx.action.title), action: "update", changes: { audit_de_depart: { from: "brouillon", to: `validé (${audit.scopeKey === GLOBAL_SCOPE ? "périmètre global" : "établissement"})` } }, user });
  return { ok: true, data: { applied, notApplied } };
}

// --- Exploitation des constats -----------------------------------------------------------------------------------------

// Action corrective à partir d'un constat : idempotente (une seule action de traitement par constat), via le module Actions.
export async function createCorrectiveAction(findingId: string, body: any, user: User): Promise<Result<{ id: string; created: boolean }>> {
  const finding = await prisma.auditFinding.findUnique({ where: { id: findingId } });
  if (!finding || !finding.baselineAuditId) return fail(404, "Constat d'audit de départ introuvable.");
  if (finding.type === "point_fort") return fail(400, "Un point fort ne nécessite pas d'action corrective.");
  const existing = await prisma.action.findFirst({ where: { auditFindingId: findingId }, select: { id: true } });
  if (existing) return { ok: true, data: { id: existing.id, created: false } };
  const audit = await prisma.baselineAudit.findUnique({ where: { id: finding.baselineAuditId }, include: { measures: true } });
  if (!audit) return fail(404, "Audit d'origine introuvable.");
  const ctx = await loadContext(audit.actionId);
  if (!ctx || !ctx.cycle) return fail(400, "Objectif introuvable.");
  const target = resolveTarget(ctx, audit.establishmentId);
  const indicatorId = audit.measures.length === 1 ? target.indicatorFor(audit.measures[0].goalIndicatorId) : null;
  const draft = correctiveActionDraft(finding);
  const actor = body?.responsableActorId ? await prisma.actor.findUnique({ where: { id: String(body.responsableActorId) }, select: { name: true } }) : null;
  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.action.create({
      data: {
        ownerType: target.ownerType, ownerId: target.ownerId, establishmentId: target.establishmentId, strategicGoalCycleId: target.primaryCycleId, indicatorId,
        title: body?.title && String(body.title).trim() ? String(body.title).trim() : draft.title, comments: body?.description ? String(body.description) : draft.comments,
        responsableActorId: body?.responsableActorId || null, responsable: actor?.name || null, priority: body?.priority || "normale",
        echeance: body?.echeance ? new Date(body.echeance) : null, status: "a_faire", origine: "audit", auditFindingId: finding.id,
      },
    });
    await tx.auditFinding.update({ where: { id: finding.id }, data: { statut: "en_traitement" } });
    return a;
  });
  await logAudit({ entityType: "action", entityId: created.id, entityLabel: truncateLabel(created.title), action: "create", user });
  return { ok: true, data: { id: created.id, created: true } };
}

// Ajoute un risque identifié par l'audit au registre des risques existant (idempotent), lié à l'objectif.
export async function registerAuditRisk(auditId: string, index: number, user: User): Promise<Result<{ riskId: string; created: boolean }>> {
  const audit = await prisma.baselineAudit.findUnique({ where: { id: auditId } });
  if (!audit) return fail(404, "Audit introuvable.");
  if (audit.statut !== "valide") return fail(409, "L'audit doit être validé avant d'enregistrer un risque.");
  const contenu = asContenu(audit.contenu);
  const item = contenu.risques[index];
  if (!item) return fail(400, "Risque introuvable dans l'audit.");
  const already = contenu.riskIds?.[index];
  if (already) return { ok: true, data: { riskId: already, created: false } };
  const ctx = await loadContext(audit.actionId);
  if (!ctx || !ctx.cycle) return fail(400, "Objectif introuvable.");
  const target = resolveTarget(ctx, audit.establishmentId);
  const risk = await prisma.$transaction(async (tx) => {
    const r = await tx.risk.create({ data: { ownerType: target.ownerType, ownerId: target.ownerId, establishmentId: target.establishmentId, description: item.description, criticite: item.criticite } });
    for (const cycleId of target.linkCycleIds) await tx.strategicGoalLink.create({ data: { strategicGoalCycleId: cycleId, riskId: r.id, nature: "associe" } });
    const riskIds = contenu.risques.map((_, i) => (i === index ? r.id : contenu.riskIds?.[i] ?? null));
    await tx.baselineAudit.update({ where: { id: audit.id }, data: { contenu: { ...contenu, riskIds } as unknown as Prisma.InputJsonValue } });
    return r;
  });
  await logAudit({ entityType: "risk", entityId: risk.id, entityLabel: truncateLabel(risk.description), action: "create", user });
  return { ok: true, data: { riskId: risk.id, created: true } };
}
