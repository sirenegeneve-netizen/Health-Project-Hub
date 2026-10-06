import { prisma } from "@/lib/db";
import {
  GATE_OUTCOME_LABELS,
  TRACKED_KINDS,
  evaluateAutoSource,
  evaluateGate,
  expectedItemState,
  gateDecisionAllowed,
  isItemKind,
  nextCriterionStatus,
  nextStageKey,
  phaseChangeAllowed,
  type ExpectedItem,
  type ExpectedState,
  type GateEvaluation,
  type GateOutcome,
  type ItemKind,
  type StageFacts,
  type TaggedObject,
} from "@/lib/templatePlan";

// Exécution côté initiative (Lot 2) : éléments attendus, critères automatiques, Gate.
// Tout s'appuie sur la copie figée du parcours (InitiativeStage) — une initiative sans cette copie
// (antérieure au moteur) n'est jamais concernée : les fonctions renvoient null et l'écran reste inchangé.

type StageRow = {
  id: string;
  key: string;
  label: string;
  objectif: string | null;
  position: number;
  obligatoire: boolean;
  gateMode: string | null;
  legacyPhases: string[];
  expected: unknown;
};

export function parseExpected(json: unknown): ExpectedItem[] {
  if (!Array.isArray(json)) return [];
  const out: ExpectedItem[] = [];
  for (const raw of json) {
    if (raw && typeof raw === "object" && isItemKind((raw as any).kind) && typeof (raw as any).label === "string") {
      out.push({ kind: (raw as any).kind, label: (raw as any).label, obligatoire: (raw as any).obligatoire !== false });
    }
  }
  return out;
}

async function loadTagged(initiativeId: string, stageId: string): Promise<Record<ItemKind, TaggedObject[]>> {
  const where = { initiativeId, initiativeStageId: stageId };
  const [livrables, actions, decisions, risques, kpis] = await Promise.all([
    prisma.deliverable.findMany({ where, select: { name: true, status: true } }),
    prisma.action.findMany({ where, select: { title: true, status: true } }),
    prisma.decision.findMany({ where, select: { subject: true, status: true } }),
    prisma.risk.findMany({ where, select: { description: true, status: true } }),
    prisma.kpi.findMany({ where, select: { name: true } }),
  ]);
  return {
    livrable: livrables.map((o) => ({ label: o.name, status: o.status })),
    action: actions.map((o) => ({ label: o.title, status: o.status })),
    decision: decisions.map((o) => ({ label: o.subject, status: o.status })),
    risque: risques.map((o) => ({ label: o.description, status: o.status })),
    indicateur: kpis.map((o) => ({ label: o.name, status: "ok" })),
    role: [],
    information: [],
  };
}

export interface ExpectedWithState extends ExpectedItem {
  state: ExpectedState;
}

export async function collectStageFacts(initiativeId: string, stage: StageRow): Promise<{ facts: StageFacts; expected: ExpectedWithState[] }> {
  const now = new Date();
  const items = parseExpected(stage.expected);
  const [openBlockingRisks, blockingAnomalies, overdueActions, tagged] = await Promise.all([
    prisma.risk.count({ where: { initiativeId, criticite: { in: ["forte", "critique"] }, status: { notIn: ["maitrise", "cloture"] } } }),
    prisma.anomaly.count({ where: { initiativeId, criticite: { in: ["majeure", "critique"] }, status: { in: ["ouverte", "en_correction"] } } }),
    prisma.action.count({ where: { initiativeId, echeance: { lt: now }, status: { notIn: ["termine", "abandonne"] } } }),
    loadTagged(initiativeId, stage.id),
  ]);
  const expected: ExpectedWithState[] = items.map((it) => ({ ...it, state: expectedItemState(it, tagged[it.kind]) }));
  const missing = (kind: ItemKind) => expected.filter((e) => e.kind === kind && e.obligatoire && e.state !== "done").length;
  return {
    expected,
    facts: {
      openBlockingRisks,
      blockingAnomalies,
      overdueActions,
      requiredDeliverablesMissing: missing("livrable"),
      requiredDecisionsMissing: missing("decision"),
      requiredActionsMissing: missing("action"),
    },
  };
}

export interface StageState {
  stage: StageRow;
  criteria: { id: string; label: string; status: string; obligatoire: boolean; mode: string; autoSource: string | null }[];
  expected: ExpectedWithState[];
  facts: StageFacts;
  evaluation: GateEvaluation;
  history: { id: string; outcome: string; comment: string | null; userName: string | null; unmetCount: number; createdAt: Date }[];
  nextKey: string | null;
}

// Charge l'état d'une étape et applique les critères automatiques/hybrides (met à jour les statuts en base
// quand la source l'impose). Renvoie null si l'initiative n'a pas de copie figée de cette étape.
export async function getStageState(initiativeId: string, stageKey: string): Promise<StageState | null> {
  const stage = await prisma.initiativeStage.findUnique({ where: { initiativeId_key: { initiativeId, key: stageKey } } });
  if (!stage) return null;

  const { facts, expected } = await collectStageFacts(initiativeId, stage);
  const rows = await prisma.stageCriterion.findMany({ where: { initiativeId, stageKey }, orderBy: { order: "asc" } });

  const criteria: StageState["criteria"] = [];
  for (const c of rows) {
    let status = c.status;
    if (c.mode !== "manuel" && c.autoSource) {
      const met = evaluateAutoSource(c.autoSource, facts);
      const next = nextCriterionStatus(c.mode, c.status, met);
      if (next !== c.status) {
        await prisma.stageCriterion.update({ where: { id: c.id }, data: { status: next } });
        status = next;
      }
    }
    criteria.push({ id: c.id, label: c.label, status, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource });
  }

  const [history, ordered] = await Promise.all([
    prisma.stageGateDecision.findMany({ where: { initiativeId, stageKey }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.initiativeStage.findMany({ where: { initiativeId, active: true }, orderBy: { position: "asc" }, select: { key: true } }),
  ]);
  return {
    stage,
    criteria,
    expected,
    facts,
    evaluation: evaluateGate({ gateMode: stage.gateMode, criteria, facts }),
    history,
    nextKey: nextStageKey(ordered.map((o) => o.key), stageKey),
  };
}

// --- Création d'un élément attendu comme objet HPH réel (rattaché à l'étape) -----------------------------

export async function createExpectedObject(
  initiativeId: string,
  stage: { id: string },
  kind: ItemKind,
  label: string,
  extra: { value?: number } = {}
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const base = { initiativeId, initiativeStageId: stage.id };
  const owner = { ownerType: "initiative", ownerId: initiativeId };
  switch (kind) {
    case "livrable":
      return { ok: true, id: (await prisma.deliverable.create({ data: { ...base, name: label } })).id };
    case "action":
      return { ok: true, id: (await prisma.action.create({ data: { ...base, ...owner, title: label, origine: "manuel" } })).id };
    case "decision":
      return { ok: true, id: (await prisma.decision.create({ data: { ...base, ...owner, subject: label } })).id };
    case "risque":
      return { ok: true, id: (await prisma.risk.create({ data: { ...base, ...owner, description: label } })).id };
    case "indicateur": {
      if (typeof extra.value !== "number" || Number.isNaN(extra.value)) return { ok: false, error: "Une valeur numérique est requise pour créer l'indicateur." };
      return { ok: true, id: (await prisma.kpi.create({ data: { ...base, name: label, value: extra.value } })).id };
    }
    default:
      return { ok: false, error: "Ce type d'élément n'est pas suivi par un objet HPH." };
  }
}

export function isTrackedKind(kind: ItemKind): boolean {
  return TRACKED_KINDS.includes(kind);
}

// --- Décision de Gate -------------------------------------------------------------------------------------------

export async function recordGateDecision(opts: {
  initiativeId: string;
  stageKey: string;
  outcome: GateOutcome;
  comment: string | null;
  user: { id: string; name: string };
}): Promise<{ ok: boolean; advancedTo?: string | null; evaluation?: GateEvaluation; status?: number; error?: string }> {
  const state = await getStageState(opts.initiativeId, opts.stageKey);
  if (!state) return { ok: false, status: 404, error: "Étape introuvable pour cette initiative." };
  if (state.stage.gateMode !== "consultatif" && state.stage.gateMode !== "bloquant") {
    return { ok: false, status: 400, error: "Cette étape n'a pas de Gate." };
  }
  const verdict = gateDecisionAllowed(opts.outcome, state.evaluation);
  if (!verdict.ok) return { ok: false, status: 409, error: verdict.reason || "Décision refusée." };

  const outcomeLabel = GATE_OUTCOME_LABELS[opts.outcome];
  const unmetLabels = state.evaluation.conditions.filter((c) => !c.met).map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  let advancedTo: string | null = null;

  await prisma.$transaction(async (tx) => {
    // Décision HPH existante réutilisée : visible dans Décisions / Journal comme toute autre décision.
    const decision = await tx.decision.create({
      data: {
        initiativeId: opts.initiativeId,
        ownerType: "initiative",
        ownerId: opts.initiativeId,
        initiativeStageId: state.stage.id,
        subject: `Gate — ${state.stage.label}`,
        context: unmetLabels.length ? `Conditions non réunies : ${unmetLabels.join(" ; ")}` : "Toutes les conditions de passage étaient réunies.",
        decision: opts.comment ? `${outcomeLabel} — ${opts.comment}` : outcomeLabel,
        decideur: opts.user.name,
        date: new Date(),
        status: "decision_prise",
      },
    });
    await tx.stageGateDecision.create({
      data: {
        initiativeId: opts.initiativeId,
        stageKey: state.stage.key,
        stageLabel: state.stage.label,
        outcome: opts.outcome,
        comment: opts.comment,
        unmetCount: state.evaluation.unmet,
        gateMode: state.stage.gateMode,
        userId: opts.user.id,
        userName: opts.user.name,
        decisionId: decision.id,
      },
    });
    if (verdict.advance && state.nextKey) {
      await tx.initiative.update({ where: { id: opts.initiativeId }, data: { phase: state.nextKey } });
      advancedTo = state.nextKey;
    }
  });
  return { ok: true, advancedTo, evaluation: state.evaluation };
}

// --- Garde du changement manuel de phase (route PATCH de l'initiative) ----------------------------------

export async function checkPhaseChange(initiativeId: string, currentPhase: string, newPhase: string): Promise<{ allowed: boolean; message?: string }> {
  if (!newPhase || newPhase === currentPhase) return { allowed: true };
  const stages = await prisma.initiativeStage.findMany({ where: { initiativeId, active: true }, orderBy: { position: "asc" } });
  if (stages.length === 0) return { allowed: true };
  const from = stages.find((s) => s.key === currentPhase || s.legacyPhases.includes(currentPhase));
  if (!from || from.gateMode !== "bloquant") return { allowed: true };
  const to = stages.find((s) => s.key === newPhase || s.legacyPhases.includes(newPhase));
  if (!to) return { allowed: true };
  const { facts } = await collectStageFacts(initiativeId, from);
  const rows = await prisma.stageCriterion.findMany({ where: { initiativeId, stageKey: from.key }, select: { obligatoire: true, status: true } });
  const evaluation = evaluateGate({ gateMode: from.gateMode, criteria: rows, facts });
  const ok = phaseChangeAllowed({ orderedKeys: stages.map((s) => s.key), fromKey: from.key, toKey: to.key, fromGateMode: from.gateMode, evaluation });
  return ok ? { allowed: true } : { allowed: false, message: `Le Gate de l'étape « ${from.label} » est bloquant : ${evaluation.unmet} condition${evaluation.unmet > 1 ? "s" : ""} de passage non réunie${evaluation.unmet > 1 ? "s" : ""}.` };
}
