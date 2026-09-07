export type StageStatus = "done" | "current" | "upcoming";

export interface Stage {
  key: string;
  label: string;
  status: StageStatus;
}

// Regroupe les phases détaillées du projet (§6 cycle de vie) dans les 6 grandes
// étapes du fil de progression demandé. Une phase peut être ambiguë (ex. "tests"
// sert autant la Validation que l'Accompagnement) — on prend le rattachement le
// plus représentatif pour un repère visuel rapide, pas une vérité absolue.
const STAGE_BUCKETS: [string, string[]][] = [
  ["Cadrage", ["opportunite", "qualification", "cadrage", "kick_off"]],
  ["Conception", ["analyse_ecosysteme", "recueil_besoins", "analyse_ecarts", "conception", "parametrage"]],
  ["Réalisation", ["interoperabilite", "migration"]],
  ["Validation", ["tests", "preparation_go_no_go"]],
  ["Déploiement", ["go_no_go", "deploiement", "hypercare", "stabilisation"]],
  ["Run", ["run", "amelioration_continue", "cloture", "retex", "formation"]],
];

export function getLifecycleStages(phase: string): Stage[] {
  const currentIndex = STAGE_BUCKETS.findIndex(([, phases]) => phases.includes(phase));
  return STAGE_BUCKETS.map(([label], i) => ({
    key: label,
    label,
    status: currentIndex === -1 ? "upcoming" : i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}
