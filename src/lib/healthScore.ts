import { prisma } from "@/lib/db";

export type HealthLevel = "vert" | "orange" | "rouge";

export interface HealthScoreResult {
  level: HealthLevel;
  label: string;
  reasons: string[];
  metrics: {
    lateActions: number;
    criticalOpenRisks: number;
    blockingInterfaces: number;
    pendingDecisions: number;
    openCriticalAnomalies: number;
    autonomyRate: number | null; // 0..1, null si aucune donnée de formation
    planningDeltaDays: number | null;
  };
}

const LABELS: Record<HealthLevel, string> = {
  vert: "Maîtrisé",
  orange: "À surveiller",
  rouge: "À risque",
};

// Le calcul est volontairement explicable (pas de boîte noire) : chaque signal
// qui contribue au score produit une phrase, affichée à l'utilisateur — cf. §40
// du cahier des charges ("le système doit surtout expliquer pourquoi").
export async function computeHealthScore(initiativeId: string): Promise<HealthScoreResult> {
  const initiative = await prisma.initiative.findUniqueOrThrow({
    where: { id: initiativeId },
    include: {
      actions: true,
      risks: { include: { interfaceRef: false } },
      decisions: true,
      interfaces: true,
      anomalies: true,
      trainings: true,
      baselines: { orderBy: { createdAt: "asc" } },
    },
  });

  const now = new Date();

  const lateActions = initiative.actions.filter(
    (a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status)
  );

  const criticalOpenRisks = initiative.risks.filter(
    (r) => ["forte", "critique"].includes(r.criticite) && !["maitrise", "cloture"].includes(r.status)
  );

  const blockingInterfaces = initiative.interfaces.filter(
    (i) => i.isBlocking || i.status === "bloquant"
  );

  const pendingDecisions = initiative.decisions.filter((d) => d.status !== "decision_prise");

  const openCriticalAnomalies = initiative.anomalies.filter(
    (a) => a.criticite === "critique" && !["corrigee", "validee"].includes(a.status)
  );

  const totalUsers = initiative.trainings.reduce((sum, t) => sum + t.nbUsers, 0);
  const autonomousUsers = initiative.trainings.reduce(
    (sum, t) => sum + (t.autonomyLevel >= 2 ? t.nbFormes : 0),
    0
  );
  const autonomyRate = totalUsers > 0 ? autonomousUsers / totalUsers : null;

  let planningDeltaDays: number | null = null;
  if (initiative.baselines.length > 0 && initiative.targetDate) {
    const initial = initiative.baselines[0].targetDate;
    planningDeltaDays = Math.round(
      (initiative.targetDate.getTime() - initial.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const reasons: string[] = [];
  if (lateActions.length > 0) reasons.push(`Retard sur ${lateActions.length} action(s)`);
  if (criticalOpenRisks.length > 0) reasons.push(`Risque critique ouvert (${criticalOpenRisks.length})`);
  if (blockingInterfaces.length > 0) reasons.push(`${blockingInterfaces.length} interface(s) bloquante(s)`);
  if (pendingDecisions.length > 0) reasons.push(`Décision bloquante en attente (${pendingDecisions.length})`);
  if (openCriticalAnomalies.length > 0) reasons.push(`${openCriticalAnomalies.length} anomalie(s) critique(s) non corrigée(s)`);
  if (autonomyRate !== null) reasons.push(`Autonomie utilisateurs : ${Math.round(autonomyRate * 100)} %`);
  if (planningDeltaDays !== null && planningDeltaDays !== 0) {
    reasons.push(planningDeltaDays > 0 ? `Retard de ${planningDeltaDays} jour(s) vs plan initial` : `Avance de ${Math.abs(planningDeltaDays)} jour(s) vs plan initial`);
  }

  let level: HealthLevel = "vert";
  if (
    blockingInterfaces.length > 0 ||
    criticalOpenRisks.length >= 2 ||
    lateActions.length >= 3 ||
    openCriticalAnomalies.length > 0 ||
    (planningDeltaDays !== null && planningDeltaDays > 10)
  ) {
    level = "rouge";
  } else if (
    lateActions.length >= 1 ||
    criticalOpenRisks.length >= 1 ||
    pendingDecisions.length >= 2 ||
    (autonomyRate !== null && autonomyRate < 0.8) ||
    (planningDeltaDays !== null && planningDeltaDays > 0)
  ) {
    level = "orange";
  }

  if (initiative.healthOverride && ["vert", "orange", "rouge"].includes(initiative.healthOverride)) {
    level = initiative.healthOverride as HealthLevel;
    reasons.unshift("niveau forcé manuellement par le chef de projet");
  }

  if (reasons.length === 0) reasons.push("aucun signal de risque détecté");

  return {
    level,
    label: LABELS[level],
    reasons,
    metrics: {
      lateActions: lateActions.length,
      criticalOpenRisks: criticalOpenRisks.length,
      blockingInterfaces: blockingInterfaces.length,
      pendingDecisions: pendingDecisions.length,
      openCriticalAnomalies: openCriticalAnomalies.length,
      autonomyRate,
      planningDeltaDays,
    },
  };
}
