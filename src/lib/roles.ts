export type Role = "administrateur" | "referent_etablissement" | "directeur" | "chef_de_projet";
export type ScopeType = "plateforme" | "groupe" | "etablissement" | "initiative";
export type PermissionAction = "voir" | "creer" | "modifier" | "supprimer" | "valider" | "gererUtilisateurs" | "gererStructure";

export const GLOBAL_SCOPE_ID = "GLOBAL";

export const ROLE_LABELS: Record<Role, string> = {
  administrateur: "Administrateur",
  referent_etablissement: "Référent établissement",
  directeur: "Directeur",
  chef_de_projet: "Chef de projet",
};

export const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  plateforme: "Plateforme",
  groupe: "Groupe",
  etablissement: "Établissement",
  initiative: "Initiative",
};

// Portées valides par rôle — appliqué côté API à la création/édition d'une
// UserAssignment, pas contraint en base.
export const ROLE_ALLOWED_SCOPES: Record<Role, ScopeType[]> = {
  administrateur: ["plateforme", "groupe"],
  referent_etablissement: ["etablissement"],
  directeur: ["groupe", "etablissement"],
  chef_de_projet: ["groupe", "etablissement", "initiative"],
};

// Matrice de permissions V1 — arbitrages de l'utilisatrice (2026-09-30) :
// suppression réservée administrateur/référent établissement, validation
// ouverte à tous, gestion de structure réservée administrateur. Le profil de
// "referent_etablissement" (admin-like mais borné à son établissement) est
// une proposition non explicitement validée — à confirmer à l'usage.
export const PERMISSIONS: Record<Role, Record<PermissionAction, boolean>> = {
  administrateur: { voir: true, creer: true, modifier: true, supprimer: true, valider: true, gererUtilisateurs: true, gererStructure: true },
  referent_etablissement: { voir: true, creer: true, modifier: true, supprimer: true, valider: true, gererUtilisateurs: true, gererStructure: false },
  directeur: { voir: true, creer: true, modifier: true, supprimer: false, valider: true, gererUtilisateurs: false, gererStructure: false },
  chef_de_projet: { voir: true, creer: true, modifier: true, supprimer: false, valider: true, gererUtilisateurs: false, gererStructure: false },
};
