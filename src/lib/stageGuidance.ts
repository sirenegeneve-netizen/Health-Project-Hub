// Un texte de contexte court par étape, pour les 9 types d'initiative autres
// que Déploiement (qui garde ses 8 pages dédiées existantes). Indexé par clé
// d'étape seule (pas par type) : une même clé — "validation", "cloture",
// "preparation"... — recouvre le même sens d'un type à l'autre, donc pas de
// duplication. Complète WORKFLOWS dans workflowSeedData.ts ; à mettre à jour
// si de nouvelles clés d'étape y apparaissent (repli générique sinon).
export const STAGE_GUIDANCE: Record<string, string> = {
  // evolution
  expression_besoin: "Le besoin est formalisé avec le demandeur : quoi, pourquoi, pour qui.",
  analyse_impact: "On évalue ce que l'évolution touche : autres modules, interfaces, utilisateurs, charge.",
  conception: "La solution est conçue dans le détail avant tout développement.",
  realisation: "Développement ou paramétrage effectif de ce qui a été conçu.",
  recette: "Le demandeur vérifie que ce qui a été livré correspond au besoin exprimé.",
  deploiement: "Mise à disposition de l'évolution en environnement de production.",
  stabilisation: "Suivi rapproché après mise en service pour détecter tout effet de bord.",
  cloture: "Bilan de l'initiative et capitalisation avant classement définitif.",
  // interoperabilite
  analyse_flux: "Les flux de données concernés sont cartographiés : source, cible, format, fréquence.",
  developpement: "Construction technique des connecteurs, mappings ou webservices concernés.",
  tests: "Vérification technique des flux avant validation métier.",
  validation: "Validation formelle par les parties prenantes avant mise en production.",
  mise_en_production: "Bascule effective en environnement de production.",
  // migration
  analyse: "Étude de l'existant à migrer : volumes, qualité des données, contraintes.",
  preparation: "Préparation technique et organisationnelle de l'opération à venir.",
  migration: "Exécution de l'opération de migration proprement dite.",
  controles: "Contrôles de cohérence et de complétude après l'opération.",
  // mise_a_niveau
  analyse_compatibilite: "Vérification de la compatibilité de la nouvelle version avec l'existant.",
  preparation_environnement: "Préparation des environnements techniques nécessaires à la montée de version.",
  montee_de_version: "Exécution de la montée de version.",
  tests_non_regression: "Vérification qu'aucune fonctionnalité existante n'a été dégradée.",
  // cybersecurite
  diagnostic_initial: "État des lieux de la situation de sécurité actuelle.",
  analyse_risques: "Identification et priorisation des risques de sécurité à traiter.",
  plan_remediation: "Définition des actions correctives et de leur séquencement.",
  mise_en_oeuvre: "Exécution des actions correctives ou de mise en conformité prévues.",
  controle_test: "Vérification que les mesures mises en œuvre sont efficaces.",
  // reglementaire
  veille_analyse_ecart: "Identification de l'exigence réglementaire et de l'écart avec la situation actuelle.",
  cadrage_mise_en_conformite: "Définition du périmètre et du plan de mise en conformité.",
  controle_conformite: "Vérification que la conformité est effectivement atteinte.",
  // formation
  besoin: "Le besoin de formation est identifié : public, compétences visées.",
  formation: "Sessions de formation effectivement dispensées.",
  evaluation: "Mesure de l'acquisition des compétences et de la satisfaction des participants.",
  // audit
  collecte_analyse: "Collecte des éléments et analyse au regard du référentiel retenu.",
  restitution: "Présentation des constats aux parties prenantes.",
  plan_actions: "Définition des actions correctives issues de l'audit.",
  suivi: "Suivi de l'avancement des actions correctives jusqu'à leur clôture.",
  // autre
  cadrage: "Le périmètre, les objectifs et les parties prenantes de l'initiative sont posés.",
};

export function stageGuidance(key: string): string {
  return STAGE_GUIDANCE[key] || "Étape du parcours de cette initiative.";
}
