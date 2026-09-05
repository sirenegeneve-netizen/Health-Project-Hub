// Calculs automatiques (§24) — dérivés des données réelles, jamais inventés.
// Chaque fonction retourne `null` quand la donnée sous-jacente n'existe pas,
// pour que l'UI puisse choisir de masquer l'indicateur plutôt que d'afficher un 0 trompeur.

export interface ActionLike {
  status: string;
}

export function computeProgress(actions: ActionLike[]): number | null {
  if (actions.length === 0) return null;
  const done = actions.filter((a) => a.status === "termine").length;
  return Math.round((done / actions.length) * 100);
}

export interface BudgetLineLike {
  prevision: number;
  engage: number;
  reel: number;
}

export interface BudgetSummary {
  budget: number; // budget révisé si défini, sinon initial
  engage: number;
  reel: number;
  reste: number;
  consumptionRate: number; // 0..100, basé sur le réel
}

export function computeBudgetSummary(
  budgetInitialEur: number | null,
  budgetReviseEur: number | null,
  lines: BudgetLineLike[]
): BudgetSummary | null {
  const budget = budgetReviseEur ?? budgetInitialEur;
  const hasLines = lines.length > 0;
  if (budget === null && !hasLines) return null;

  const engage = lines.reduce((s, l) => s + l.engage, 0);
  const reel = lines.reduce((s, l) => s + l.reel, 0);
  const effectiveBudget = budget ?? lines.reduce((s, l) => s + l.prevision, 0);

  return {
    budget: effectiveBudget,
    engage,
    reel,
    reste: effectiveBudget - reel,
    consumptionRate: effectiveBudget > 0 ? Math.round((reel / effectiveBudget) * 100) : 0,
  };
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
