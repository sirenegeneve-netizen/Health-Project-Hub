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
export async function computeHealthScore(projectId: string): Promise<HealthScoreResult> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
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

  const lateActions = project.actions.filter(
    (a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status)
  );

  const criticalOpenRisks = project.risks.filter(
    (r) => ["forte", "critique"].includes(r.criticite) && !["maitrise", "cloture"].includes(r.status)
  );

  const blockingInterfaces = project.interfaces.filter(
    (i) => i.isBlocking || i.status === "bloquant"
  );

  const pendingDecisions = project.decisions.filter((d) => d.status !== "decision_prise");

  const openCriticalAnomalies = project.anomalies.filter(
    (a) => a.criticite === "critique" && !["corrigee", "validee"].includes(a.status)
  );

  const totalUsers = project.trainings.reduce((sum, t) => sum + t.nbUsers, 0);
  const autonomousUsers = project.trainings.reduce(
    (sum, t) => sum + (t.autonomyLevel >= 2 ? t.nbFormes : 0),
    0
  );
  const autonomyRate = totalUsers > 0 ? autonomousUsers / totalUsers : null;

  let planningDeltaDays: number | null = null;
  if (project.baselines.length > 0 && project.targetDate) {
    const initial = project.baselines[0].targetDate;
    planningDeltaDays = Math.round(
      (project.targetDate.getTime() - initial.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const reasons: string[] = [];
  if (lateActions.length > 0) reasons.push(`${lateActions.length} action(s) en retard`);
  if (criticalOpenRisks.length > 0) reasons.push(`${criticalOpenRisks.length} risque(s) fort/critique ouvert(s)`);
  if (blockingInterfaces.length > 0) reasons.push(`${blockingInterfaces.length} interface(s) bloquante(s)`);
  if (pendingDecisions.length > 0) reasons.push(`${pendingDecisions.length} décision(s) en attente`);
  if (openCriticalAnomalies.length > 0) reasons.push(`${openCriticalAnomalies.length} anomalie(s) critique(s) non corrigée(s)`);
  if (autonomyRate !== null) reasons.push(`autonomie utilisateurs : ${Math.round(autonomyRate * 100)} %`);
  if (planningDeltaDays !== null && planningDeltaDays !== 0) {
    reasons.push(`prévision : ${planningDeltaDays > 0 ? "+" : ""}${planningDeltaDays} jour(s) vs baseline initiale`);
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

  if (project.healthOverride && ["vert", "orange", "rouge"].includes(project.healthOverride)) {
    level = project.healthOverride as HealthLevel;
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
