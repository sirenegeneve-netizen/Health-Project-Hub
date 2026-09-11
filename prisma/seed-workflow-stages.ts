import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Socles de workflow par type d'initiative (architecture Groupe > Établissement
// > Initiative, §6 du document de conception). Idempotent : upsert sur
// (initiativeType, key), relançable sans risque.
//
// Le type "deploiement" reprend exactement l'ancien parcours en 9 étapes
// (STAGES de lib/lifecycle.ts), y compris ses legacyPhases, pour préserver le
// comportement des initiatives existantes.

type StageSeed = { key: string; label: string; legacyPhases?: string[] };

const WORKFLOWS: Record<string, StageSeed[]> = {
  deploiement: [
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
  ],
  evolution: [
    { key: "expression_besoin", label: "Expression du besoin" },
    { key: "analyse_impact", label: "Analyse d'impact" },
    { key: "conception", label: "Conception" },
    { key: "realisation", label: "Réalisation" },
    { key: "recette", label: "Recette" },
    { key: "deploiement", label: "Déploiement" },
    { key: "stabilisation", label: "Stabilisation" },
    { key: "cloture", label: "Clôture" },
  ],
  interoperabilite: [
    { key: "analyse_flux", label: "Analyse des flux" },
    { key: "conception", label: "Conception" },
    { key: "developpement", label: "Développement" },
    { key: "tests", label: "Tests" },
    { key: "validation", label: "Validation" },
    { key: "mise_en_production", label: "Mise en production" },
    { key: "stabilisation", label: "Stabilisation" },
    { key: "cloture", label: "Clôture" },
  ],
  migration: [
    { key: "analyse", label: "Analyse" },
    { key: "preparation", label: "Préparation" },
    { key: "migration", label: "Migration" },
    { key: "controles", label: "Contrôles" },
    { key: "validation", label: "Validation" },
    { key: "cloture", label: "Clôture" },
  ],
  mise_a_niveau: [
    { key: "analyse_compatibilite", label: "Analyse de compatibilité" },
    { key: "preparation_environnement", label: "Préparation environnement" },
    { key: "montee_de_version", label: "Montée de version" },
    { key: "tests_non_regression", label: "Tests de non-régression" },
    { key: "validation", label: "Validation" },
    { key: "cloture", label: "Clôture" },
  ],
  cybersecurite: [
    { key: "diagnostic_initial", label: "Diagnostic initial" },
    { key: "analyse_risques", label: "Analyse des risques" },
    { key: "plan_remediation", label: "Plan de remédiation" },
    { key: "mise_en_oeuvre", label: "Mise en œuvre" },
    { key: "controle_test", label: "Contrôle / test" },
    { key: "validation", label: "Validation" },
    { key: "cloture", label: "Clôture" },
  ],
  reglementaire: [
    { key: "veille_analyse_ecart", label: "Veille / analyse d'écart" },
    { key: "cadrage_mise_en_conformite", label: "Cadrage de mise en conformité" },
    { key: "mise_en_oeuvre", label: "Mise en œuvre" },
    { key: "controle_conformite", label: "Contrôle de conformité" },
    { key: "validation", label: "Validation" },
    { key: "cloture", label: "Clôture" },
  ],
  formation: [
    { key: "besoin", label: "Besoin" },
    { key: "preparation", label: "Préparation" },
    { key: "formation", label: "Formation" },
    { key: "evaluation", label: "Évaluation" },
    { key: "cloture", label: "Clôture" },
  ],
  audit: [
    { key: "preparation", label: "Préparation" },
    { key: "collecte_analyse", label: "Collecte / analyse" },
    { key: "restitution", label: "Restitution" },
    { key: "plan_actions", label: "Plan d'actions" },
    { key: "suivi", label: "Suivi" },
    { key: "cloture", label: "Clôture" },
  ],
  autre: [
    { key: "cadrage", label: "Cadrage" },
    { key: "realisation", label: "Réalisation" },
    { key: "validation", label: "Validation" },
    { key: "cloture", label: "Clôture" },
  ],
};

async function main() {
  let count = 0;
  for (const [initiativeType, stages] of Object.entries(WORKFLOWS)) {
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.workflowStage.upsert({
        where: { initiativeType_key: { initiativeType, key: s.key } },
        create: { initiativeType, ordre: i, key: s.key, label: s.label, legacyPhases: s.legacyPhases || [] },
        update: { ordre: i, label: s.label, legacyPhases: s.legacyPhases || [] },
      });
      count++;
    }
    console.log(`${initiativeType} : ${stages.length} étape(s) seedée(s)`);
  }
  console.log(`Terminé. ${count} étape(s) au total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
