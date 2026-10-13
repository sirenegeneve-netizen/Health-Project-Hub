// Listes de référence des objectifs stratégiques — logique pure (aucune dépendance Prisma/Next), testée unitairement.
// On stocke des CODES stables (jamais les libellés) : un libellé peut évoluer sans toucher aux données.

export interface RefItem {
  code: string;
  label: string;
}

// A. Périmètre organisationnel (sélection multiple)
export const PERIMETRES_ORGANISATIONNELS: readonly RefItem[] = [
  { code: "groupe", label: "Groupe hospitalier / Ensemble du groupe" },
  { code: "siege", label: "Siège / Direction générale" },
  { code: "direction_etablissement", label: "Direction d'établissement" },
  { code: "etablissement", label: "Établissement hospitalier" },
  { code: "pole_departement", label: "Pôle / Département clinique" },
  { code: "service_unite", label: "Service / Unité de soins" },
  { code: "plateau_medico_technique", label: "Plateau médico-technique" },
  { code: "consultations_ambulatoire", label: "Consultations / Ambulatoire" },
  { code: "urgences_soins_critiques", label: "Urgences / Soins critiques" },
  { code: "systemes_information", label: "Systèmes d'information / Informatique" },
  { code: "qualite_risques", label: "Qualité / Gestion des risques" },
  { code: "ressources_humaines", label: "Ressources humaines" },
  { code: "finances_controle_gestion", label: "Finances / Contrôle de gestion" },
  { code: "logistique_achats", label: "Logistique / Achats / Approvisionnements" },
  { code: "technique_infrastructures", label: "Technique / Infrastructures / Maintenance" },
  { code: "pharmacie", label: "Pharmacie / Circuit du médicament" },
  { code: "hygiene_infections", label: "Hygiène / Prévention des infections" },
  { code: "recherche_enseignement", label: "Recherche / Enseignement" },
  { code: "processus_transversal", label: "Processus transversal interservices" },
  { code: "transversal_interetablissements", label: "Périmètre transversal interétablissements" },
  { code: "infrastructure_commune", label: "Infrastructure ou plateforme commune" },
  { code: "partenaires_prestataires", label: "Partenaires / Prestataires externes" },
];

// B. Population concernée (sélection multiple)
export const AUCUNE_POPULATION = "aucune_population";
export const POPULATIONS: readonly RefItem[] = [
  { code: "patients_hospitalises", label: "Patients hospitalisés" },
  { code: "patients_ambulatoires", label: "Patients ambulatoires" },
  { code: "usagers_visiteurs", label: "Usagers / Visiteurs" },
  { code: "proches_aidants", label: "Proches / Aidants" },
  { code: "personnel_medical", label: "Personnel médical" },
  { code: "personnel_soignant", label: "Personnel soignant" },
  { code: "personnel_medico_technique", label: "Personnel médico-technique" },
  { code: "personnel_administratif", label: "Personnel administratif" },
  { code: "personnel_technique_logistique", label: "Personnel technique / Logistique" },
  { code: "equipes_informatiques", label: "Équipes informatiques" },
  { code: "encadrement_managers", label: "Encadrement / Managers" },
  { code: "direction_gouvernance", label: "Direction / Gouvernance" },
  { code: "ensemble_collaborateurs", label: "Ensemble des collaborateurs" },
  { code: "liberaux_correspondants", label: "Professionnels libéraux / Correspondants" },
  { code: "partenaires_institutionnels", label: "Partenaires institutionnels" },
  { code: "prestataires_fournisseurs", label: "Prestataires / Fournisseurs" },
  { code: "etudiants_stagiaires", label: "Étudiants / Stagiaires" },
  { code: "benevoles_associations", label: "Bénévoles / Associations" },
  { code: AUCUNE_POPULATION, label: "Aucune population directe — objectif structurel ou organisationnel" },
];

// Thème de l'indicateur (sélection unique) : dimension mesurée. Distinct de l'axe stratégique, du domaine métier
// et du niveau organisationnel de pilotage.
export const THEMES_INDICATEUR: readonly RefItem[] = [
  { code: "strategique", label: "Stratégique" },
  { code: "prevention_risques", label: "Prévention et maîtrise des risques" },
  { code: "humain_competences", label: "Humain et compétences" },
  { code: "qualite_performance", label: "Qualité et performance" },
  { code: "patients_experience", label: "Patients et expérience usager" },
  { code: "conformite_reglementation", label: "Conformité et réglementation" },
  { code: "financier_ressources", label: "Financier et ressources" },
  { code: "transformation_amelioration", label: "Transformation et amélioration continue" },
];

const codes = (list: readonly RefItem[]) => list.map((i) => i.code);
export const isPerimetreOrg = (v: unknown): boolean => typeof v === "string" && codes(PERIMETRES_ORGANISATIONNELS).includes(v);
export const isPopulation = (v: unknown): boolean => typeof v === "string" && codes(POPULATIONS).includes(v);
export const isTheme = (v: unknown): boolean => typeof v === "string" && codes(THEMES_INDICATEUR).includes(v);

export function labelOf(list: readonly RefItem[], code: string): string {
  return list.find((i) => i.code === code)?.label ?? code;
}

// Dédoublonne et ne garde que les codes connus ; l'ordre de la nomenclature est conservé (affichage stable).
export function sanitizeCodes(list: readonly RefItem[], input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter((v): v is string => typeof v === "string"));
  return list.filter((i) => wanted.has(i.code)).map((i) => i.code);
}

// Renvoie les valeurs inconnues d'une saisie (pour répondre 400 plutôt que d'ignorer silencieusement).
export function unknownCodes(list: readonly RefItem[], input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(codes(list));
  return input.filter((v) => typeof v !== "string" || !known.has(v)).map(String);
}

// « Aucune population directe » est exclusive : l'ajouter vide le reste, ajouter autre chose le retire.
// `previous` permet de savoir ce que l'utilisateur vient de cocher.
export function normalizePopulations(next: readonly string[], previous: readonly string[] = []): string[] {
  const clean = sanitizeCodes(POPULATIONS, next);
  if (!clean.includes(AUCUNE_POPULATION)) return clean;
  const others = clean.filter((c) => c !== AUCUNE_POPULATION);
  if (others.length === 0) return [AUCUNE_POPULATION];
  const justAddedNone = !previous.includes(AUCUNE_POPULATION);
  return justAddedNone ? [AUCUNE_POPULATION] : others;
}
