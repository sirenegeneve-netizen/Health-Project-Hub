import type { HealthLevel } from "@/lib/healthScore";

export interface Readiness {
  level: HealthLevel;
  label: string;
  reasons: string[];
}

function levelFromScore(score: number, total: number): HealthLevel {
  const ratio = score / total;
  if (ratio >= 1) return "vert";
  if (ratio >= 0.5) return "orange";
  return "rouge";
}

// Cadrage — « Le projet est-il suffisamment cadré pour être lancé ? »
export function computeCadrageReadiness(inputs: {
  hasObjectifs: boolean;
  stakeholdersCount: number;
  actorsCount: number;
  hasBudget: boolean;
  hasTargetDate: boolean;
}): Readiness {
  const checks: [boolean, string][] = [
    [inputs.hasObjectifs, "objectifs et périmètre non renseignés"],
    [inputs.stakeholdersCount > 0, "aucune partie prenante identifiée"],
    [inputs.actorsCount > 0, "gouvernance non définie (aucun acteur)"],
    [inputs.hasBudget, "budget initial non renseigné"],
    [inputs.hasTargetDate, "date cible non renseignée"],
  ];
  const passed = checks.filter(([ok]) => ok).length;
  const level = levelFromScore(passed, checks.length);
  const label = level === "vert" ? "Cadrage complet" : level === "orange" ? "Cadrage partiel" : "Cadrage insuffisant";
  const reasons = checks.filter(([ok]) => !ok).map(([, r]) => r);
  return { level, label, reasons: reasons.length ? reasons : ["tous les éléments de cadrage sont renseignés"] };
}

// Réalisation — « Sommes-nous en train d'avancer ? »
export function computeRealisationMomentum(inputs: { totalActions: number; lateActions: number; recentActivityCount: number }): Readiness {
  if (inputs.totalActions === 0) {
    return { level: "rouge", label: "Pas de dynamique visible", reasons: ["aucune action enregistrée pour ce projet"] };
  }
  const reasons: string[] = [];
  if (inputs.lateActions > 0) reasons.push(`${inputs.lateActions} action(s) en retard`);
  if (inputs.recentActivityCount === 0) reasons.push("aucune activité enregistrée ces 14 derniers jours");

  let level: HealthLevel = "vert";
  if (inputs.lateActions >= 3 || inputs.recentActivityCount === 0) level = "rouge";
  else if (inputs.lateActions > 0) level = "orange";

  const label = level === "vert" ? "Le projet avance" : level === "orange" ? "Avancement à surveiller" : "Avancement au ralenti";
  return { level, label, reasons: reasons.length ? reasons : ["actions à jour, activité récente constatée"] };
}

// Validation — « Sommes-nous prêts à déployer ? »
export function computeValidationReadiness(inputs: { openAnomalies: number; criticalOpenAnomalies: number }): Readiness {
  let level: HealthLevel = "vert";
  if (inputs.criticalOpenAnomalies > 0) level = "rouge";
  else if (inputs.openAnomalies > 0) level = "orange";
  const label = level === "vert" ? "Prêt côté validation" : level === "orange" ? "Validation en cours" : "Anomalies critiques bloquantes";
  const reasons =
    level === "vert"
      ? ["aucune anomalie ouverte"]
      : [
          inputs.criticalOpenAnomalies > 0 && `${inputs.criticalOpenAnomalies} anomalie(s) critique(s) ouverte(s)`,
          inputs.openAnomalies > inputs.criticalOpenAnomalies && `${inputs.openAnomalies - inputs.criticalOpenAnomalies} anomalie(s) non critique(s) ouverte(s)`,
        ].filter(Boolean) as string[];
  return { level, label, reasons };
}

// Déploiement — « Peut-on passer en production ? »
export function computeDeploymentReadiness(criteria: { ok: boolean; label: string }[]): Readiness {
  const passed = criteria.filter((c) => c.ok).length;
  const level = levelFromScore(passed, criteria.length);
  const label = level === "vert" ? "Prêt pour le Go-Live" : level === "orange" ? "Presque prêt" : "Pas prêt pour la production";
  const reasons = criteria.filter((c) => !c.ok).map((c) => c.label);
  return { level, label, reasons: reasons.length ? reasons : ["tous les critères sont au vert"] };
}

// Run — « Le projet est-il stabilisé ? »
export function computeStabilityReadiness(inputs: { blockingInterfaces: number; criticalOpenRisks: number; autonomyRate: number | null }): Readiness {
  const checks: [boolean, string][] = [
    [inputs.blockingInterfaces === 0, `${inputs.blockingInterfaces} interface(s) bloquante(s)`],
    [inputs.criticalOpenRisks === 0, `${inputs.criticalOpenRisks} risque(s) critique(s) ouvert(s)`],
    [inputs.autonomyRate === null || inputs.autonomyRate >= 0.8, inputs.autonomyRate !== null ? `autonomie à ${Math.round(inputs.autonomyRate * 100)}%` : "autonomie non mesurée"],
  ];
  const passed = checks.filter(([ok]) => ok).length;
  const level = levelFromScore(passed, checks.length);
  const label = level === "vert" ? "Projet stabilisé" : level === "orange" ? "Stabilisation en cours" : "Instable";
  const reasons = checks.filter(([ok]) => !ok).map(([, r]) => r);
  return { level, label, reasons: reasons.length ? reasons : ["aucun signal d'instabilité"] };
}

// Évolutions — « Que doit-on améliorer ? » (lecture du backlog non trié plutôt qu'un indicateur de santé)
export function computeBacklogTriage(untriagedCount: number): Readiness {
  let level: HealthLevel = "vert";
  if (untriagedCount >= 4) level = "rouge";
  else if (untriagedCount > 0) level = "orange";
  const label = level === "vert" ? "Backlog à jour" : "Demandes à trier";
  return { level, label, reasons: untriagedCount > 0 ? [`${untriagedCount} demande(s) non qualifiée(s)`] : ["toutes les demandes sont qualifiées"] };
}
