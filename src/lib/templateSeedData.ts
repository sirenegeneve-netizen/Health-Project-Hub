// Données de départ du moteur de modèles de projet (Lot 1).
// Pures (aucune dépendance Next/Prisma) : partagées entre la route admin
// /api/admin/migrate-project-templates, le script prisma/seed-project-templates.ts
// et les tests. Tout est idempotent côté seed : rien n'écrase une donnée existante.

export interface ProjectTypeSeed {
  key: string;
  label: string;
  family: string;
}

// Les clés historiques sont conservées à l'identique (Initiative.type n'est jamais réécrit).
// « autre » est affiché « Personnalisé » : un seul type pour « aucun type ne correspond ».
export const PROJECT_TYPES: ProjectTypeSeed[] = [
  // Transformation / SI
  { key: "deploiement", label: "Déploiement", family: "Transformation / SI" },
  { key: "evolution", label: "Évolution", family: "Transformation / SI" },
  { key: "remplacement", label: "Remplacement / Renouvellement", family: "Transformation / SI" },
  { key: "mise_a_niveau", label: "Mise à niveau / Upgrade", family: "Transformation / SI" },
  { key: "migration", label: "Migration", family: "Transformation / SI" },
  { key: "decommissionnement", label: "Décommissionnement / Retrait", family: "Transformation / SI" },
  { key: "industrialisation", label: "Industrialisation", family: "Transformation / SI" },
  { key: "optimisation", label: "Optimisation / Amélioration", family: "Transformation / SI" },
  // Données / interopérabilité
  { key: "interoperabilite", label: "Interopérabilité", family: "Données / interopérabilité" },
  { key: "migration_donnees", label: "Migration de données", family: "Données / interopérabilité" },
  { key: "qualite_donnees", label: "Qualité des données", family: "Données / interopérabilité" },
  { key: "gouvernance_donnees", label: "Gouvernance des données", family: "Données / interopérabilité" },
  { key: "bi_reporting", label: "BI / Reporting / Décisionnel", family: "Données / interopérabilité" },
  // Infrastructure / technique
  { key: "infrastructure", label: "Infrastructure", family: "Infrastructure / technique" },
  { key: "architecture", label: "Architecture", family: "Infrastructure / technique" },
  { key: "cloud_hebergement", label: "Cloud / Hébergement", family: "Infrastructure / technique" },
  { key: "reseau_telecom", label: "Réseau / Télécom", family: "Infrastructure / technique" },
  { key: "poste_mobilite", label: "Poste de travail / Mobilité", family: "Infrastructure / technique" },
  // Sécurité / continuité
  { key: "cybersecurite", label: "Cybersécurité", family: "Sécurité / continuité" },
  { key: "protection_donnees", label: "Protection des données", family: "Sécurité / continuité" },
  { key: "continuite_pra", label: "Continuité d'activité / PRA", family: "Sécurité / continuité" },
  { key: "incidents_remediation", label: "Gestion des incidents / Remédiation", family: "Sécurité / continuité" },
  // Qualité / conformité
  { key: "reglementaire", label: "Réglementaire", family: "Qualité / conformité" },
  { key: "qualite", label: "Qualité", family: "Qualité / conformité" },
  { key: "certification", label: "Certification / Accréditation", family: "Qualité / conformité" },
  { key: "audit", label: "Audit", family: "Qualité / conformité" },
  { key: "gestion_risques", label: "Gestion des risques", family: "Qualité / conformité" },
  { key: "amelioration_continue", label: "Amélioration continue", family: "Qualité / conformité" },
  // Métier / organisation
  { key: "organisation_processus", label: "Organisation / Processus", family: "Métier / organisation" },
  { key: "formation", label: "Formation", family: "Métier / organisation" },
  { key: "accompagnement_changement", label: "Accompagnement au changement", family: "Métier / organisation" },
  { key: "nouveau_service", label: "Développement d'un nouveau service", family: "Métier / organisation" },
  { key: "innovation", label: "Expérimentation / Innovation", family: "Métier / organisation" },
  // Autres
  { key: "etude_faisabilite", label: "Étude / Faisabilité", family: "Autres" },
  { key: "urgence_remediation", label: "Urgence / Remédiation", family: "Autres" },
  { key: "autre", label: "Personnalisé", family: "Autres" },
];

export interface StageLibraryEntry {
  label: string;
  objectif: string;
  criteria: string[];
  // Anciennes phases résolues vers cette étape (compatibilité avec Initiative.phase).
  legacyPhases?: string[];
}

// Critères historiques (stageCriteria.ts) — conservés à l'identique.
const LEGACY_KICKOFF = ["Support de Kick-off préparé", "Compte rendu diffusé", "Planning confirmé avec les parties prenantes", "Responsabilités confirmées"];
const LEGACY_PREPARATION = [
  "Prérequis techniques réunis",
  "Prérequis organisationnels réunis",
  "Établissements prêts",
  "Données disponibles",
  "Paramétrage réalisé",
  "Comptes et droits créés",
  "Environnement de déploiement prêt",
  "Planning détaillé partagé",
];
const LEGACY_CLOTURE = [
  "Objectifs de l'initiative atteints",
  "Livrables terminés",
  "Risques résiduels revus",
  "Budget final validé",
  "Bilan rédigé",
  "Transfert au support / à l'exploitation effectué",
];

export const STAGE_LIBRARY: Record<string, StageLibraryEntry> = {
  kickoff: { label: "Kick-off", objectif: "Lancer officiellement le projet et aligner toutes les parties prenantes.", criteria: LEGACY_KICKOFF, legacyPhases: ["kick_off"] },
  demande: { label: "Demande", objectif: "Qualifier et enregistrer la demande initiale.", criteria: ["Demande formalisée", "Demandeur identifié", "Pertinence de la demande confirmée"] },
  cadrage: { label: "Cadrage", objectif: "Définir le périmètre, les enjeux, les objectifs et les contraintes.", criteria: ["Périmètre et objectifs formalisés", "Parties prenantes identifiées", "Sponsor et chef de projet désignés", "Budget et planning macro validés"] },
  diagnostic: { label: "Diagnostic", objectif: "Établir l'état des lieux de la situation actuelle.", criteria: ["État des lieux réalisé", "Constats partagés avec les parties prenantes", "Points de départ mesurés"] },
  analyse: { label: "Analyse", objectif: "Analyser en profondeur le besoin, la situation ou les causes.", criteria: ["Analyse documentée", "Conclusions revues avec le métier"] },
  analyse_besoin: { label: "Analyse du besoin", objectif: "Recueillir et formaliser le besoin des utilisateurs.", criteria: ["Besoins recueillis auprès des utilisateurs", "Besoins priorisés", "Besoin validé par le demandeur"] },
  analyse_impact: { label: "Analyse d'impact", objectif: "Mesurer les impacts métier, SI, organisationnels et réglementaires.", criteria: ["Impacts métier identifiés", "Impacts SI identifiés", "Parties prenantes impactées informées"] },
  analyse_exigences: { label: "Analyse des exigences", objectif: "Identifier et qualifier les exigences applicables.", criteria: ["Référentiel d'exigences identifié", "Exigences applicables qualifiées", "Périmètre d'application confirmé"] },
  analyse_risques: { label: "Analyse des risques", objectif: "Identifier et évaluer les risques du périmètre.", criteria: ["Risques identifiés", "Risques évalués (gravité × probabilité)", "Registre des risques à jour"] },
  analyse_ecart: { label: "Analyse des écarts", objectif: "Mesurer l'écart entre l'existant et la cible attendue.", criteria: ["Cible de référence établie", "Écarts identifiés et qualifiés", "Écarts priorisés"] },
  analyse_existant: { label: "Analyse de l'existant", objectif: "Documenter la solution, les usages et les dépendances actuels.", criteria: ["Inventaire de l'existant réalisé", "Dépendances et interfaces recensées", "Limites de l'existant formalisées"] },
  analyse_donnees: { label: "Analyse des données", objectif: "Qualifier les données sources, leur volume et leur qualité.", criteria: ["Inventaire des données sources réalisé", "Qualité des données évaluée", "Règles de mapping source/cible définies"] },
  analyse_flux: { label: "Analyse des flux", objectif: "Cartographier les flux d'échange à mettre en place ou à modifier.", criteria: ["Flux cartographiés", "Systèmes émetteurs et récepteurs identifiés", "Standards et formats d'échange retenus"] },
  analyse_compatibilite: { label: "Analyse de compatibilité", objectif: "Vérifier la compatibilité de la nouvelle version avec l'environnement.", criteria: ["Prérequis de la version vérifiés", "Compatibilité des interfaces vérifiée", "Impacts de la montée de version listés"] },
  choix: { label: "Choix", objectif: "Arbitrer et retenir la solution cible.", criteria: ["Options comparées", "Critères de choix formalisés", "Décision de choix tracée"] },
  conception: { label: "Conception", objectif: "Concevoir la solution cible.", criteria: ["Solution cible conçue", "Conception revue avec les parties prenantes", "Conception validée"] },
  specifications: { label: "Spécifications", objectif: "Spécifier précisément ce qui doit être réalisé.", criteria: ["Spécifications rédigées", "Spécifications validées par le métier", "Critères de recette définis"] },
  preparation: { label: "Préparation", objectif: "Réunir les prérequis avant la réalisation ou le déploiement.", criteria: LEGACY_PREPARATION },
  realisation: { label: "Réalisation", objectif: "Réaliser ce qui a été conçu et planifié.", criteria: ["Plan de réalisation suivi", "Livrables de réalisation produits", "Avancement partagé régulièrement"] },
  developpement: { label: "Développement", objectif: "Développer les composants prévus.", criteria: ["Développements terminés", "Revue de code ou de configuration réalisée"] },
  configuration: { label: "Configuration", objectif: "Paramétrer la solution selon les spécifications.", criteria: ["Paramétrage réalisé", "Paramétrage documenté"] },
  deploiement: { label: "Déploiement", objectif: "Déployer la solution sur le périmètre prévu.", criteria: ["Déploiement réalisé sur le périmètre prévu", "Environnements conformes", "Écarts de déploiement traités"], legacyPhases: ["interoperabilite", "migration", "realisation", "deploiement"] },
  migration_pilote: { label: "Migration pilote", objectif: "Valider la méthode de migration sur un échantillon représentatif.", criteria: ["Périmètre pilote défini", "Migration pilote exécutée", "Résultats du pilote analysés", "Ajustements décidés"] },
  migration: { label: "Migration", objectif: "Exécuter la migration sur le périmètre complet.", criteria: ["Plan de bascule validé", "Migration exécutée", "Plan de retour arrière disponible"] },
  migration_transfert: { label: "Migration / Transfert", objectif: "Transférer les données, usages et responsabilités vers la cible.", criteria: ["Données ou usages transférés", "Utilisateurs informés", "Transfert tracé"] },
  tests: { label: "Tests", objectif: "Vérifier que la solution fonctionne conformément au besoin.", criteria: ["Plan de tests défini", "Tests exécutés", "Anomalies bloquantes traitées"] },
  tests_integration: { label: "Tests d'intégration", objectif: "Vérifier les échanges de bout en bout entre les systèmes.", criteria: ["Scénarios d'intégration définis", "Flux testés de bout en bout", "Erreurs d'échange traitées"] },
  tests_non_regression: { label: "Tests de non-régression", objectif: "S'assurer que l'existant n'est pas dégradé.", criteria: ["Jeu de non-régression exécuté", "Régressions corrigées ou acceptées"] },
  controles: { label: "Contrôles", objectif: "Contrôler la conformité des résultats obtenus.", criteria: ["Contrôles planifiés exécutés", "Écarts relevés et traités", "Résultats des contrôles tracés"] },
  validation: { label: "Validation", objectif: "Valider formellement que le résultat répond au besoin.", criteria: ["Tests réalisés", "Anomalies bloquantes résolues", "Validation métier obtenue", "Documentation disponible"], legacyPhases: ["tests", "preparation_go_no_go", "validation"] },
  formation: { label: "Formation", objectif: "Former les personnes concernées.", criteria: ["Sessions planifiées", "Sessions réalisées", "Support de formation diffusé"] },
  formation_accompagnement: { label: "Formation & Accompagnement", objectif: "Former et accompagner les utilisateurs jusqu'à l'autonomie.", criteria: ["Populations cibles identifiées", "Formations réalisées", "Support utilisateur disponible"], legacyPhases: ["formation"] },
  accompagnement: { label: "Accompagnement", objectif: "Accompagner les utilisateurs après la formation.", criteria: ["Dispositif d'accompagnement en place", "Retours des utilisateurs collectés"] },
  evaluation: { label: "Évaluation", objectif: "Évaluer les résultats obtenus.", criteria: ["Critères d'évaluation définis", "Évaluation réalisée", "Résultats partagés"] },
  mise_en_production: { label: "Mise en production", objectif: "Décider et réaliser la mise en production en sécurité.", criteria: ["Critères de Go réunis", "Aucun risque bloquant ouvert", "Livrables obligatoires disponibles", "Validation métier obtenue"], legacyPhases: ["go_no_go"] },
  stabilisation: { label: "Stabilisation", objectif: "Stabiliser le fonctionnement après la mise en production.", criteria: ["Incidents post-mise en production traités", "Indicateurs de stabilité atteints", "Transfert au support préparé"], legacyPhases: ["hypercare", "stabilisation"] },
  surveillance: { label: "Surveillance", objectif: "Surveiller dans la durée le bon fonctionnement et les risques résiduels.", criteria: ["Indicateurs de surveillance définis", "Alertes et seuils configurés", "Revue périodique planifiée"] },
  restitution: { label: "Restitution", objectif: "Restituer les résultats aux décideurs.", criteria: ["Support de restitution préparé", "Restitution réalisée", "Retours collectés"] },
  constats: { label: "Constats", objectif: "Consolider et qualifier les constats.", criteria: ["Constats consolidés", "Constats qualifiés (criticité)", "Constats confirmés avec les audités"] },
  plan_actions: { label: "Plan d'actions", objectif: "Définir les actions à mener, leurs responsables et leurs échéances.", criteria: ["Actions définies", "Responsables désignés", "Échéances validées"] },
  plan_remediation: { label: "Plan de remédiation", objectif: "Planifier la correction des vulnérabilités ou anomalies.", criteria: ["Mesures de remédiation définies", "Priorisation validée", "Ressources allouées"] },
  plan_amelioration: { label: "Plan d'amélioration", objectif: "Définir les améliorations à mettre en œuvre.", criteria: ["Améliorations priorisées", "Responsables désignés", "Indicateurs de succès définis"] },
  identification: { label: "Identification", objectif: "Identifier les risques ou éléments du périmètre.", criteria: ["Sources d'identification couvertes", "Éléments identifiés recensés"] },
  traitement: { label: "Traitement", objectif: "Traiter les risques retenus.", criteria: ["Stratégie de traitement choisie", "Mesures de traitement engagées", "Risque résiduel évalué"] },
  mise_en_oeuvre: { label: "Mise en œuvre", objectif: "Mettre en œuvre les actions décidées.", criteria: ["Actions engagées selon le plan", "Avancement suivi", "Écarts au plan traités"] },
  mise_en_conformite: { label: "Mise en conformité", objectif: "Mettre en œuvre les mesures de conformité.", criteria: ["Mesures de conformité mises en œuvre", "Preuves de conformité collectées"] },
  montee_version: { label: "Montée de version", objectif: "Réaliser la montée de version.", criteria: ["Plan de montée de version validé", "Sauvegarde et retour arrière prêts", "Montée de version réalisée"] },
  verification: { label: "Vérification", objectif: "Vérifier que les mesures mises en œuvre sont effectives.", criteria: ["Plan de vérification défini", "Vérifications réalisées", "Écarts résiduels traités"] },
  verification_efficacite: { label: "Vérification d'efficacité", objectif: "Mesurer l'efficacité réelle des actions menées.", criteria: ["Indicateurs d'efficacité mesurés", "Objectifs atteints ou écarts expliqués"] },
  perennisation: { label: "Pérennisation", objectif: "Ancrer durablement les résultats dans l'organisation.", criteria: ["Responsabilités de suivi attribuées", "Procédures mises à jour", "Revue périodique planifiée"] },
  suivi: { label: "Suivi", objectif: "Suivre la mise en œuvre jusqu'à la clôture des actions.", criteria: ["Suivi périodique réalisé", "Actions échues relancées"] },
  audit_externe: { label: "Audit de certification", objectif: "Passer l'audit externe de certification ou d'accréditation.", criteria: ["Audit à blanc réalisé", "Audit externe planifié", "Écarts de l'audit traités"] },
  decision: { label: "Décision", objectif: "Prendre la décision de suite à donner.", criteria: ["Options présentées", "Décision prise et tracée"] },
  retrait: { label: "Retrait", objectif: "Retirer effectivement le système ou service concerné.", criteria: ["Accès fermés", "Système retiré", "Données archivées ou détruites conformément aux règles"] },
  decommissionnement: { label: "Décommissionnement", objectif: "Décommissionner l'ancienne solution une fois la cible stable.", criteria: ["Ancienne solution arrêtée", "Données conservées conformément aux règles", "Licences et contrats résiliés"] },
  cloture: { label: "Clôture", objectif: "Clôturer le projet et capitaliser.", criteria: LEGACY_CLOTURE, legacyPhases: ["run", "amelioration_continue", "cloture", "retex"] },
};

// Parcours par type. Suffixe « ? » = étape optionnelle (non obligatoire).
export const TYPE_PARCOURS: Record<string, string[]> = {
  deploiement: ["kickoff", "cadrage", "preparation", "deploiement", "validation", "formation_accompagnement", "mise_en_production", "stabilisation", "cloture"],
  evolution: ["demande", "analyse", "cadrage", "kickoff?", "conception", "realisation", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  remplacement: ["cadrage", "analyse_existant", "choix", "preparation", "deploiement", "migration", "validation", "mise_en_production", "decommissionnement", "cloture"],
  mise_a_niveau: ["cadrage", "analyse_compatibilite", "preparation", "montee_version", "tests_non_regression", "validation", "mise_en_production", "stabilisation", "cloture"],
  migration: ["kickoff", "cadrage", "analyse_donnees", "preparation", "migration_pilote", "controles", "migration", "validation", "stabilisation", "cloture"],
  decommissionnement: ["cadrage", "analyse_impact", "preparation", "migration_transfert", "validation", "retrait", "controles", "cloture"],
  industrialisation: ["cadrage", "analyse", "conception", "realisation", "tests", "validation", "deploiement", "stabilisation", "cloture"],
  optimisation: ["cadrage", "diagnostic", "analyse", "plan_amelioration", "mise_en_oeuvre", "verification_efficacite", "cloture"],
  interoperabilite: ["kickoff", "cadrage", "analyse_flux", "specifications", "realisation", "tests_integration", "validation", "mise_en_production", "surveillance", "cloture"],
  migration_donnees: ["cadrage", "analyse_donnees", "specifications", "preparation", "migration_pilote", "controles", "migration", "validation", "cloture"],
  qualite_donnees: ["cadrage", "diagnostic", "analyse", "plan_amelioration", "mise_en_oeuvre", "verification_efficacite", "surveillance", "cloture"],
  gouvernance_donnees: ["cadrage", "diagnostic", "conception", "mise_en_oeuvre", "validation", "perennisation", "cloture"],
  bi_reporting: ["cadrage", "analyse_besoin", "conception", "realisation", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  infrastructure: ["cadrage", "analyse", "conception", "preparation", "realisation", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  architecture: ["cadrage", "diagnostic", "analyse", "conception", "validation", "restitution", "cloture"],
  cloud_hebergement: ["cadrage", "analyse_existant", "conception", "preparation", "migration", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  reseau_telecom: ["cadrage", "analyse", "conception", "preparation", "deploiement", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  poste_mobilite: ["cadrage", "preparation", "deploiement", "validation", "formation_accompagnement", "stabilisation", "cloture"],
  cybersecurite: ["cadrage", "analyse_risques", "evaluation", "plan_remediation", "mise_en_oeuvre", "verification", "validation", "surveillance", "cloture"],
  protection_donnees: ["cadrage", "analyse_exigences", "analyse_risques", "plan_actions", "mise_en_conformite", "verification", "validation", "perennisation", "cloture"],
  continuite_pra: ["cadrage", "analyse_impact", "conception", "preparation", "mise_en_oeuvre", "tests", "validation", "perennisation", "cloture"],
  incidents_remediation: ["diagnostic", "analyse", "plan_remediation", "mise_en_oeuvre", "verification", "validation", "surveillance", "cloture"],
  reglementaire: ["cadrage", "analyse_exigences", "analyse_ecart", "plan_actions", "mise_en_conformite", "verification", "validation", "perennisation", "cloture"],
  qualite: ["cadrage", "diagnostic", "analyse_ecart", "plan_amelioration", "mise_en_oeuvre", "verification_efficacite", "perennisation", "cloture"],
  certification: ["cadrage", "analyse_exigences", "analyse_ecart", "plan_actions", "mise_en_conformite", "preparation", "audit_externe", "suivi", "cloture"],
  audit: ["kickoff?", "cadrage", "preparation", "realisation", "constats", "restitution", "plan_actions", "suivi", "cloture"],
  gestion_risques: ["cadrage", "identification", "analyse", "evaluation", "traitement", "verification", "surveillance", "cloture"],
  amelioration_continue: ["diagnostic", "analyse", "plan_amelioration", "mise_en_oeuvre", "verification_efficacite", "perennisation", "cloture"],
  organisation_processus: ["cadrage", "diagnostic", "conception", "preparation", "mise_en_oeuvre", "formation_accompagnement", "verification_efficacite", "perennisation", "cloture"],
  formation: ["analyse_besoin", "conception", "preparation", "formation", "evaluation", "accompagnement", "cloture"],
  accompagnement_changement: ["cadrage", "analyse_impact", "plan_actions", "preparation", "formation_accompagnement", "mise_en_oeuvre", "verification_efficacite", "perennisation", "cloture"],
  nouveau_service: ["cadrage", "analyse_besoin", "conception", "realisation", "tests", "validation", "mise_en_production", "stabilisation", "cloture"],
  innovation: ["cadrage", "conception", "realisation", "evaluation", "decision", "cloture"],
  etude_faisabilite: ["kickoff?", "cadrage", "analyse_besoin", "analyse", "analyse_risques", "restitution", "decision", "cloture"],
  urgence_remediation: ["diagnostic", "plan_remediation", "mise_en_oeuvre", "verification", "stabilisation", "cloture"],
  autre: ["cadrage", "realisation", "validation", "cloture"],
};

// Modèle général : repli de tout type sans modèle actif (ex. type créé par un administrateur).
export const GENERAL_TEMPLATE = {
  typeKey: "defaut",
  familyId: "std-defaut",
  name: "Modèle général",
  parcours: ["cadrage", "kickoff", "preparation", "realisation", "validation", "cloture"],
};

// « Même étape, contenu différent selon le type » (« Modèle + Étape »).
// Clé = `${stageKey}:${typeKey}` ; remplace les critères et/ou l'objectif de la bibliothèque.
export const STAGE_OVERRIDES: Record<string, { objectif?: string; criteria?: string[] }> = {
  "validation:deploiement": {
    objectif: "Valider que la solution déployée répond au besoin avant la mise en production.",
    criteria: ["Tests réalisés", "Anomalies bloquantes résolues", "Recette métier validée", "Documentation disponible"],
  },
  "validation:migration": {
    objectif: "Valider que les données migrées sont complètes, intègres et exploitables.",
    criteria: ["Données source/cible rapprochées", "Intégrité vérifiée", "Contrôles post-migration réalisés", "Validation des utilisateurs clés"],
  },
  "validation:interoperabilite": {
    objectif: "Valider que les échanges fonctionnent de bout en bout et sont conformes.",
    criteria: ["Flux testés", "Données conformes", "Erreurs traitées", "Tests bout-en-bout réalisés"],
  },
  "validation:cybersecurite": {
    objectif: "Valider que les mesures de sécurité sont en place et efficaces.",
    criteria: ["Mesures de remédiation vérifiées", "Vulnérabilités critiques corrigées", "Risque résiduel accepté par le responsable"],
  },
  "validation:reglementaire": {
    objectif: "Valider la conformité vis-à-vis des exigences applicables.",
    criteria: ["Exigences applicables couvertes", "Preuves de conformité disponibles", "Écarts résiduels acceptés ou planifiés"],
  },
  "cadrage:migration": { objectif: "Cadrer le périmètre des données et applications à migrer, les contraintes de bascule et les échéances." },
  "cadrage:interoperabilite": { objectif: "Cadrer les systèmes à interconnecter, les cas d'usage d'échange et les contraintes de conformité." },
  "preparation:migration": {
    objectif: "Préparer l'environnement cible, les outils de migration et le plan de bascule.",
    criteria: ["Environnement cible prêt", "Outils et scripts de migration prêts", "Plan de bascule et de retour arrière validé", "Fenêtre de migration confirmée"],
  },
  "evaluation:cybersecurite": {
    objectif: "Évaluer le niveau de maîtrise des risques cyber et le risque résiduel.",
    criteria: ["Méthode d'évaluation appliquée", "Niveaux de risque établis", "Risques critiques priorisés", "Résultats validés par le RSSI"],
  },
  "evaluation:gestion_risques": {
    objectif: "Évaluer et hiérarchiser les risques identifiés.",
    criteria: ["Échelles de gravité et de probabilité appliquées", "Risques hiérarchisés", "Risques inacceptables identifiés"],
  },
  "cloture:audit": { objectif: "Clôturer l'audit et vérifier que toutes les actions ont été traitées ou reportées formellement." },
};

export const OPTIONAL_SUFFIX = "?";

export function parseStageToken(token: string): { key: string; obligatoire: boolean } {
  return token.endsWith(OPTIONAL_SUFFIX) ? { key: token.slice(0, -1), obligatoire: false } : { key: token, obligatoire: true };
}

export interface StageSpec {
  key: string;
  label: string;
  objectif: string;
  obligatoire: boolean;
  legacyPhases: string[];
  criteria: { label: string; obligatoire: boolean; mode: "manuel"; autoSource: null }[];
}

export interface TemplateSpec {
  typeKey: string;
  familyId: string;
  name: string;
  isGeneral: boolean;
  stages: StageSpec[];
}

// Critères hérités d'une configuration existante (StageCriterionTemplate) : prioritaires
// sur les valeurs de la bibliothèque pour préserver les checklists déjà saisies.
export type LegacyCriteria = Record<string, Record<string, string[]>>; // type → stageKey → labels

const LEGACY_STAGE_KEYS = ["kickoff", "preparation", "cloture"];

export function buildStageSpec(typeKey: string, token: string, legacy: LegacyCriteria = {}): StageSpec {
  const { key, obligatoire } = parseStageToken(token);
  const lib = STAGE_LIBRARY[key];
  if (!lib) throw new Error(`Étape inconnue dans la bibliothèque : ${key}`);
  const override = STAGE_OVERRIDES[`${key}:${typeKey}`];
  let labels = override?.criteria ?? lib.criteria;
  if (LEGACY_STAGE_KEYS.includes(key)) {
    const fromLegacy = legacy[typeKey]?.[key] ?? legacy["defaut"]?.[key];
    if (fromLegacy && fromLegacy.length > 0) labels = fromLegacy;
  }
  return {
    key,
    label: lib.label,
    objectif: override?.objectif ?? lib.objectif,
    obligatoire,
    legacyPhases: lib.legacyPhases ?? [],
    criteria: labels.map((label) => ({ label, obligatoire: true, mode: "manuel" as const, autoSource: null })),
  };
}

export function buildTemplateSpec(typeKey: string, legacy: LegacyCriteria = {}): TemplateSpec {
  const parcours = TYPE_PARCOURS[typeKey];
  const type = PROJECT_TYPES.find((t) => t.key === typeKey);
  if (!parcours || !type) throw new Error(`Type sans parcours : ${typeKey}`);
  return {
    typeKey,
    familyId: `std-${typeKey}`,
    name: `${type.label} — Modèle standard`,
    isGeneral: false,
    stages: parcours.map((t) => buildStageSpec(typeKey, t, legacy)),
  };
}

export function buildGeneralTemplateSpec(legacy: LegacyCriteria = {}): TemplateSpec {
  return {
    typeKey: GENERAL_TEMPLATE.typeKey,
    familyId: GENERAL_TEMPLATE.familyId,
    name: GENERAL_TEMPLATE.name,
    isGeneral: true,
    stages: GENERAL_TEMPLATE.parcours.map((t) => buildStageSpec("defaut", t, legacy)),
  };
}
