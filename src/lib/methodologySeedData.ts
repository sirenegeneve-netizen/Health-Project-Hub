// Socle méthodologique par type d'initiative (finalité / déclencheurs / prérequis
// / référentiels + risques, livrables et indicateurs typiques). Partagé entre le
// script CLI (prisma/seed-methodology.ts) et la route admin
// (/api/admin/seed-methodology), sur le même principe que workflowSeedData.ts.
//
// Les indicateurs typiques sont volontairement informatifs uniquement : le modèle
// Kpi impose une valeur mesurée (Kpi.value), qu'on ne fabrique jamais. Accepter un
// indicateur suggéré ouvre donc le formulaire de création de KPI pré-rempli plutôt
// que de créer un enregistrement avec une valeur inventée.

export type TemplateItemSeed = {
  kind: "risque" | "livrable" | "kpi";
  label: string;
  description?: string;
  probabilite?: string; // risque
  impact?: string; // risque
  unit?: string; // kpi
  categorie?: string; // kpi
};

export type MethodologyGuideSeed = {
  finalite: string;
  declencheurs: string;
  prerequis: string;
  referentiels: string[];
  items: TemplateItemSeed[];
};

export const METHODOLOGY_GUIDES: Record<string, MethodologyGuideSeed> = {
  deploiement: {
    finalite:
      "Mettre en production un nouveau logiciel ou module pour un ou plusieurs établissements, en garantissant que les utilisateurs sont prêts et que le passage en fonctionnement courant est maîtrisé.",
    declencheurs:
      "Décision d'acquisition ou de remplacement d'un système, nouvel établissement à équiper, extension du périmètre fonctionnel d'un outil déjà déployé ailleurs.",
    prerequis:
      "Établissement(s) cible(s) identifié(s), sponsor et chef de projet désignés, budget et planning cadrés, écosystème d'interfaces connu.",
    referentiels: ["HERMES", "ISTQB", "ITIL"],
    items: [
      { kind: "risque", label: "Reprise de données incomplète ou erronée", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Résistance au changement des équipes métier", probabilite: "forte", impact: "moyen" },
      { kind: "risque", label: "Interface non disponible à la date de bascule", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Sous-dimensionnement du support post-bascule (hypercare)", probabilite: "moyenne", impact: "moyen" },
      { kind: "livrable", label: "Dossier de conception (écarts besoins/cible)" },
      { kind: "livrable", label: "Plan de tests et rapport de recette" },
      { kind: "livrable", label: "Plan de formation et supports utilisateurs" },
      { kind: "livrable", label: "Dossier Go/No-Go" },
      { kind: "kpi", label: "Taux d'utilisateurs formés", unit: "%", categorie: "adoption" },
      { kind: "kpi", label: "Taux d'utilisateurs autonomes (≠ formés)", unit: "%", categorie: "adoption" },
      { kind: "kpi", label: "Anomalies bloquantes ouvertes à J+30", unit: "nb", categorie: "qualite" },
    ],
  },
  evolution: {
    finalite:
      "Faire évoluer un système déjà en production pour répondre à un nouveau besoin métier, réglementaire ou technique, sans remettre en cause l'ensemble du déploiement initial.",
    declencheurs:
      "Demande métier récurrente, écart constaté à l'usage, opportunité d'optimisation identifiée en exploitation ou lors d'un audit.",
    prerequis:
      "Système existant identifié et stable, expression du besoin formalisée, propriétaire fonctionnel désigné.",
    referentiels: ["HERMES", "ISTQB", "PDCA"],
    items: [
      { kind: "risque", label: "Régression sur des fonctionnalités existantes", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Périmètre mal cadré, dérive du besoin en cours de route", probabilite: "moyenne", impact: "moyen" },
      { kind: "risque", label: "Impact sur d'autres interfaces non anticipé", probabilite: "faible", impact: "fort" },
      { kind: "livrable", label: "Analyse d'impact" },
      { kind: "livrable", label: "Cahier de recette" },
      { kind: "kpi", label: "Taux de réussite des tests de non-régression", unit: "%", categorie: "qualite" },
    ],
  },
  interoperabilite: {
    finalite:
      "Établir ou fiabiliser un flux d'échange de données entre deux systèmes, dans le respect des standards d'interopérabilité en santé.",
    declencheurs:
      "Nouveau système à raccorder à l'écosystème existant, changement de standard d'échange, dysfonctionnement récurrent d'une interface existante.",
    prerequis: "Systèmes source et cible identifiés, standard d'échange visé connu (HL7, FHIR, DMI…), contacts techniques des deux côtés.",
    referentiels: ["HERMES", "ISTQB"],
    items: [
      { kind: "risque", label: "Incompatibilité de standard entre les deux systèmes", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Volumétrie sous-estimée entraînant des pertes de messages", probabilite: "faible", impact: "fort" },
      { kind: "risque", label: "Absence de supervision des flux en production", probabilite: "moyenne", impact: "moyen" },
      { kind: "livrable", label: "Spécification d'interface (mapping des données)" },
      { kind: "livrable", label: "Rapport de tests d'intégration" },
      { kind: "kpi", label: "Taux de messages en erreur", unit: "%", categorie: "qualite" },
    ],
  },
  migration: {
    finalite: "Faire basculer des données ou un système d'un environnement source vers un environnement cible sans perte ni altération.",
    declencheurs: "Changement d'éditeur ou de version majeure, consolidation d'environnements, fin de vie d'un système source.",
    prerequis: "Environnement cible disponible, cartographie des données source connue, fenêtre de bascule identifiée.",
    referentiels: ["HERMES", "ISTQB"],
    items: [
      { kind: "risque", label: "Perte ou corruption de données lors de la bascule", probabilite: "faible", impact: "fort" },
      { kind: "risque", label: "Durée de bascule sous-estimée (dépassement de la fenêtre autorisée)", probabilite: "moyenne", impact: "moyen" },
      { kind: "livrable", label: "Plan de migration et scénario de bascule" },
      { kind: "livrable", label: "Rapport de contrôle post-migration" },
      { kind: "kpi", label: "Taux de données contrôlées conformes", unit: "%", categorie: "qualite" },
    ],
  },
  mise_a_niveau: {
    finalite: "Faire monter de version ou mettre à niveau un système existant, pour rester compatible ou bénéficier de nouvelles fonctionnalités.",
    declencheurs: "Fin de support d'une version, exigence de compatibilité avec un autre système, recommandation éditeur.",
    prerequis: "Version cible identifiée, compatibilité avec l'écosystème existant vérifiée en amont.",
    referentiels: ["HERMES", "ITIL"],
    items: [
      { kind: "risque", label: "Incompatibilité avec une interface ou un module existant", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Indisponibilité prolongée pendant la montée de version", probabilite: "moyenne", impact: "moyen" },
      { kind: "livrable", label: "Rapport d'analyse de compatibilité" },
      { kind: "livrable", label: "Rapport de tests de non-régression" },
      { kind: "kpi", label: "Taux de tests de non-régression passés", unit: "%", categorie: "qualite" },
    ],
  },
  cybersecurite: {
    finalite: "Identifier et réduire les risques de sécurité sur un périmètre donné (système, infrastructure, données).",
    declencheurs: "Résultat d'audit ou de scan de vulnérabilités, incident de sécurité, nouvelle exigence réglementaire, nouveau système à sécuriser.",
    prerequis: "Périmètre et actifs concernés identifiés, données traitées connues (sensibilité, volumétrie).",
    referentiels: ["HERMES", "ISO 14971", "ITIL"],
    items: [
      { kind: "risque", label: "Vulnérabilité critique non corrigée dans les délais", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Mesure de sécurité impactant la disponibilité du service", probabilite: "faible", impact: "moyen" },
      { kind: "livrable", label: "Analyse des risques de sécurité" },
      { kind: "livrable", label: "Plan de remédiation" },
      { kind: "livrable", label: "Preuves de mise en œuvre des mesures" },
      { kind: "kpi", label: "Vulnérabilités critiques résiduelles", unit: "nb", categorie: "qualite" },
    ],
  },
  reglementaire: {
    finalite: "Mettre un établissement ou un système en conformité avec un texte, une norme ou une exigence réglementaire applicable.",
    declencheurs: "Publication d'un nouveau texte réglementaire, évolution d'une norme existante, constat d'écart lors d'un audit.",
    prerequis: "Texte ou exigence applicable identifié, périmètre concerné connu, état actuel documenté.",
    referentiels: ["HERMES", "ISO 9001", "ISO 13485"],
    items: [
      { kind: "risque", label: "Écart de conformité non résorbé à l'échéance réglementaire", probabilite: "moyenne", impact: "fort" },
      { kind: "risque", label: "Preuve de conformité manquante lors d'un contrôle", probabilite: "faible", impact: "fort" },
      { kind: "livrable", label: "Analyse de conformité (état actuel vs état cible)" },
      { kind: "livrable", label: "Plan d'actions correctives" },
      { kind: "livrable", label: "Dossier de preuves" },
      { kind: "kpi", label: "Taux d'exigences couvertes", unit: "%", categorie: "qualite" },
    ],
  },
  formation: {
    finalite: "Amener une population d'utilisateurs à un niveau d'autonomie réel sur un système ou un processus, au-delà de la simple présence en session.",
    declencheurs: "Déploiement ou évolution nécessitant une montée en compétence, taux d'autonomie insuffisant constaté en exploitation.",
    prerequis: "Public cible identifié, objectifs pédagogiques définis, intervenants disponibles.",
    referentiels: ["EduQua", "PDCA"],
    items: [
      { kind: "risque", label: "Taux de présence insuffisant aux sessions", probabilite: "moyenne", impact: "moyen" },
      { kind: "risque", label: "Autonomie non acquise malgré la formation réalisée", probabilite: "forte", impact: "moyen" },
      { kind: "livrable", label: "Supports de formation" },
      { kind: "livrable", label: "Feuilles de présence et évaluation des acquis" },
      { kind: "kpi", label: "Taux de participants formés", unit: "%", categorie: "adoption" },
      { kind: "kpi", label: "Taux de participants autonomes", unit: "%", categorie: "adoption" },
    ],
  },
  audit: {
    finalite: "Évaluer un système, un processus ou un établissement au regard d'un référentiel, et déclencher les actions correctives nécessaires.",
    declencheurs: "Audit périodique planifié, audit de certification, demande suite à un incident ou une non-conformité récurrente.",
    prerequis: "Référentiel et critères d'audit définis, périmètre et dates arrêtés avec l'audité.",
    referentiels: ["ISO 9001", "PDCA"],
    items: [
      { kind: "risque", label: "Non-conformité majeure non résorbée avant la prochaine échéance", probabilite: "faible", impact: "fort" },
      { kind: "risque", label: "Action corrective sans vérification d'efficacité", probabilite: "moyenne", impact: "moyen" },
      { kind: "livrable", label: "Plan d'audit" },
      { kind: "livrable", label: "Rapport de constats et écarts" },
      { kind: "livrable", label: "Plan d'actions correctives" },
      { kind: "kpi", label: "Écarts clôturés avec preuve d'efficacité", unit: "%", categorie: "qualite" },
    ],
  },
  autre: {
    finalite: "Encadrer une initiative qui ne correspond à aucun des types socles existants, avec un minimum de structure pour rester pilotable.",
    declencheurs: "Besoin ponctuel ou transverse ne relevant pas d'un des types standards.",
    prerequis: "Objectif et périmètre minimalement formulés, responsable désigné.",
    referentiels: ["HERMES"],
    items: [
      { kind: "livrable", label: "Note de cadrage" },
    ],
  },
};
