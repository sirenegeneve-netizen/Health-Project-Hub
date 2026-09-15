export type StageStatus = "done" | "current" | "upcoming";

export interface Stage {
  key: string;
  label: string;
  status: StageStatus;
}

export interface WorkflowStageDef {
  key: string;
  label: string;
  legacyPhases: string[];
}

// Socle par défaut (Déploiement), utilisé en repli si aucune séquence n'est
// encore chargée en base pour le type demandé (ex. avant l'exécution du seed
// prisma/seed-workflow-stages.ts) — ne doit normalement plus être sollicité une
// fois le seed passé, mais garde le comportement identique à l'ancien système.
export const DEFAULT_STAGES: WorkflowStageDef[] = [
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

export function computeStages(phase: string, stages: WorkflowStageDef[]): Stage[] {
  const list = stages.length ? stages : DEFAULT_STAGES;
  const currentIndex = list.findIndex((s) => s.key === phase || s.legacyPhases.includes(phase));
  return list.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: currentIndex === -1 ? "upcoming" : i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

export function stageLabelFromList(key: string, stages: WorkflowStageDef[]): string {
  const list = stages.length ? stages : DEFAULT_STAGES;
  return list.find((s) => s.key === key)?.label || key;
}
