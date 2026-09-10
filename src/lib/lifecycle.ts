export type StageStatus = "done" | "current" | "upcoming";

export interface Stage {
  key: string;
  label: string;
  status: StageStatus;
}

// Parcours du projet en 9 étapes de pilotage de déploiement (et non plus des
// phases de conception logicielle — le logiciel est déjà existant, cf. prompt
// de refonte §5). Chaque phase détaillée historiquement saisie sur un projet
// (Project.phase) est rattachée à l'étape la plus représentative pour garder
// un repère visuel simple ; ce n'est pas une vérité absolue.
export const STAGES: { key: string; label: string; legacyPhases: string[] }[] = [
  { key: "cadrage", label: "Cadrage", legacyPhases: ["opportunite", "qualification", "cadrage"] },
  { key: "kickoff", label: "Kick-off", legacyPhases: ["kick_off"] },
  {
    key: "preparation",
    label: "Préparation",
    legacyPhases: ["analyse_ecosysteme", "recueil_besoins", "analyse_ecarts", "conception", "parametrage", "preparation"],
  },
  { key: "deploiement", label: "Déploiement", legacyPhases: ["interoperabilite", "migration", "realisation", "deploiement"] },
  { key: "validation", label: "Validation", legacyPhases: ["tests", "preparation_go_no_go", "validation"] },
  { key: "formation_accompagnement", label: "Formation & Accomp.", legacyPhases: ["formation"] },
  { key: "mise_en_production", label: "Mise en production", legacyPhases: ["go_no_go"] },
  { key: "stabilisation", label: "Stabilisation", legacyPhases: ["hypercare", "stabilisation"] },
  { key: "cloture", label: "Clôture", legacyPhases: ["run", "amelioration_continue", "cloture", "retex"] },
];

export function getLifecycleStages(phase: string): Stage[] {
  const currentIndex = STAGES.findIndex((s) => s.key === phase || s.legacyPhases.includes(phase));
  return STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: currentIndex === -1 ? "upcoming" : i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label || key;
}
