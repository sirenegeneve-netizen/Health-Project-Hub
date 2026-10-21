import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, visibleEstablishmentIds, visibleGroupIds, type Assignment, type ResourceScope } from "../src/lib/authzCore";

const G1 = "g1", G2 = "g2", E1 = "e1", E2 = "e2", E3 = "e3-autre-groupe";
const ests = [{ id: E1, groupId: G1 }, { id: E2, groupId: G1 }, { id: E3, groupId: G2 }];
const as = (role: any, scopeType: any, scopeId: string): Assignment => ({ role, scopeType, scopeId });

const localE1: ResourceScope = { groupId: G1, level: "etablissement", establishmentId: E1 };
const localE2: ResourceScope = { groupId: G1, level: "etablissement", establishmentId: E2 };
const localE3: ResourceScope = { groupId: G2, level: "etablissement", establishmentId: E3 };
const groupG1: ResourceScope = { groupId: G1, level: "groupe", sharedReadEstablishmentIds: [E1] };
const projLocalE1: ResourceScope = { groupId: G1, level: "initiative", initiativeId: "p1", initiativeEstablishmentIds: [E1] };
const projShared: ResourceScope = { groupId: G1, level: "initiative", initiativeId: "p2", initiativeEstablishmentIds: [E1, E2] };
const projTransversal: ResourceScope = { groupId: G1, level: "initiative", initiativeId: "p3", initiativeEstablishmentIds: [] };

test("aucune affectation : aucun accès (plus de mode transitoire)", () => {
  for (const a of ["voir", "modifier", "creer", "supprimer"] as const) assert.equal(decide([], a, localE1).allowed, false);
});

test("utilisateur monoétablissement : lit/écrit chez lui, jamais chez un autre établissement ni un autre groupe", () => {
  const u = [as("chef_de_projet", "etablissement", E1)];
  assert.equal(decide(u, "voir", localE1).allowed, true);
  assert.equal(decide(u, "modifier", localE1).allowed, true);
  for (const a of ["voir", "modifier", "creer", "valider"] as const) {
    assert.equal(decide(u, a, localE2).allowed, false, `E2 ${a}`);
    assert.equal(decide(u, a, localE3).allowed, false, `E3 ${a}`);
  }
});

test("monoétablissement : donnée de groupe lisible seulement si partagée avec lui, jamais modifiable", () => {
  const u1 = [as("referent_etablissement", "etablissement", E1)];
  const u2 = [as("referent_etablissement", "etablissement", E2)];
  assert.equal(decide(u1, "voir", groupG1).allowed, true);
  assert.equal(decide(u1, "modifier", groupG1).allowed, false);
  assert.equal(decide(u2, "voir", groupG1).allowed, false);
});

test("multiétablissements : seulement les établissements de son périmètre", () => {
  const u = [as("directeur", "etablissement", E1), as("directeur", "etablissement", E2)];
  assert.equal(decide(u, "modifier", localE1).allowed, true);
  assert.equal(decide(u, "modifier", localE2).allowed, true);
  assert.equal(decide(u, "voir", localE3).allowed, false);
  assert.deepEqual(visibleEstablishmentIds(u, ests).sort(), [E1, E2]);
});

test("directeur de groupe : consulte les établissements de son groupe, ne modifie pas leurs données locales", () => {
  const u = [as("directeur", "groupe", G1)];
  assert.equal(decide(u, "voir", localE1).allowed, true);
  assert.equal(decide(u, "voir", localE2).allowed, true);
  for (const a of ["modifier", "creer", "supprimer", "valider"] as const) assert.equal(decide(u, a, localE1).allowed, false, a);
  assert.equal(decide(u, "voir", localE3).allowed, false); // autre groupe
  assert.equal(decide(u, "modifier", groupG1).allowed, true); // donnée de son groupe
  assert.deepEqual(visibleEstablishmentIds(u, ests).sort(), [E1, E2]);
});

test("diffusion : permission distincte (directeur et administrateur du groupe, pas chef de projet ni référent)", () => {
  assert.equal(decide([as("directeur", "groupe", G1)], "diffuser", groupG1).allowed, true);
  assert.equal(decide([as("administrateur", "groupe", G1)], "diffuser", groupG1).allowed, true);
  assert.equal(decide([as("chef_de_projet", "groupe", G1)], "diffuser", groupG1).allowed, false);
  assert.equal(decide([as("referent_etablissement", "etablissement", E1)], "diffuser", localE1).allowed, false);
  assert.equal(decide([as("directeur", "groupe", G2)], "diffuser", groupG1).allowed, false);
});

test("administrateur de groupe : administre son groupe mais ne modifie pas les données locales", () => {
  const u = [as("administrateur", "groupe", G1)];
  assert.equal(decide(u, "modifier", groupG1).allowed, true);
  assert.equal(decide(u, "modifier", localE1).allowed, false);
  assert.equal(decide(u, "voir", localE1).allowed, true);
});

test("administrateur plateforme : accès complet, écritures marquées sensibles (à tracer)", () => {
  const u = [as("administrateur", "plateforme", "GLOBAL")];
  const d = decide(u, "modifier", localE3);
  assert.equal(d.allowed, true);
  assert.equal(d.sensitive, true);
  assert.equal(decide(u, "voir", localE3).sensitive, false);
});

test("projets : local, partagé, transversal", () => {
  const e1 = [as("chef_de_projet", "etablissement", E1)];
  const e2 = [as("chef_de_projet", "etablissement", E2)];
  assert.equal(decide(e1, "modifier", projLocalE1).allowed, true);
  assert.equal(decide(e2, "voir", projLocalE1).allowed, false);
  assert.equal(decide(e2, "modifier", projShared).allowed, true); // rattaché au projet partagé
  assert.equal(decide(e1, "modifier", projTransversal).allowed, false); // aucun rattachement
  const dirG = [as("directeur", "groupe", G1)];
  assert.equal(decide(dirG, "modifier", projLocalE1).allowed, false); // local : lecture seule pour le directeur de groupe
  assert.equal(decide(dirG, "modifier", projShared).allowed, true);
  assert.equal(decide(dirG, "modifier", projTransversal).allowed, true);
  assert.equal(decide([as("chef_de_projet", "groupe", G1)], "modifier", projLocalE1).allowed, true);
  assert.equal(decide([as("chef_de_projet", "initiative", "p1")], "modifier", projLocalE1).allowed, true);
  assert.equal(decide([as("chef_de_projet", "initiative", "p1")], "modifier", projShared).allowed, false);
});

test("ressource sans rattachement identifiable : plateforme seulement", () => {
  assert.equal(decide([as("directeur", "groupe", G1)], "voir", null).allowed, false);
  assert.equal(decide([as("administrateur", "plateforme", "GLOBAL")], "voir", null).allowed, true);
});

test("visibilité : groupes et établissements consolidés selon le périmètre", () => {
  const groups = [{ id: G1 }, { id: G2 }];
  assert.deepEqual(visibleGroupIds([as("referent_etablissement", "etablissement", E3)], groups, ests), [G2]);
  assert.deepEqual(visibleEstablishmentIds([as("chef_de_projet", "initiative", "p1")], ests), []);
  assert.deepEqual(visibleEstablishmentIds([as("administrateur", "plateforme", "GLOBAL")], ests).sort(), [E1, E2, E3].sort());
});
