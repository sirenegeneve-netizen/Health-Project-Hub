import type { HealthLevel, HealthScoreResult } from "@/lib/healthScore";
import type { BudgetSummary } from "@/lib/metrics";
import { computeActorWorkload, type ActorLike, type RaciLike, type WorkloadInputs } from "@/lib/resourceGovernance";

export interface DimensionColors {
  planning: HealthLevel;
  budget: HealthLevel;
  risques: HealthLevel;
  ressources: HealthLevel;
}

// Chaque colonne de la table "Santé du portefeuille" (§4 du cahier des charges)
// isole UN facteur, contrairement au niveau de santé global qui les combine tous.
// Volontairement lisible plutôt que savant : mêmes seuils que ceux déjà utilisés
// ailleurs dans l'app (healthScore, budget) pour rester cohérent d'un écran à l'autre.
export function computeDimensionColors(
  score: HealthScoreResult,
  budget: BudgetSummary | null,
  actors: ActorLike[],
  workloadInputs: WorkloadInputs,
  raciEntries: RaciLike[]
): DimensionColors {
  const planning: HealthLevel =
    score.metrics.planningDeltaDays === null
      ? "vert"
      : score.metrics.planningDeltaDays > 10
        ? "rouge"
        : score.metrics.planningDeltaDays > 0
          ? "orange"
          : "vert";

  const budgetLevel: HealthLevel = !budget ? "vert" : budget.consumptionRate >= 100 ? "rouge" : budget.consumptionRate >= 85 ? "orange" : "vert";

  const risques: HealthLevel = score.metrics.criticalOpenRisks >= 2 ? "rouge" : score.metrics.criticalOpenRisks >= 1 ? "orange" : "vert";

  // Concentration de charge : un seul acteur qui porte beaucoup d'objets ouverts
  // dans CE projet, en attendant le vrai calcul de charge en % (Phase 4).
  const maxOwned = actors.reduce((max, actor) => {
    const w = computeActorWorkload(actor, workloadInputs, raciEntries);
    return Math.max(max, w.totalOwned);
  }, 0);
  const ressources: HealthLevel = maxOwned >= 8 ? "rouge" : maxOwned >= 5 ? "orange" : "vert";

  return { planning, budget: budgetLevel, risques, ressources };
}
