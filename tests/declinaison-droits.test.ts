import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decide } from "../src/lib/authzCore";
import { canDecideDerogation } from "../src/lib/declinaison";

// P1 — droits et garanties de non-écrasement. Sans base de données : règles pures + contrôles statiques du code.
const asg = (role: string, scopeType: string, scopeId: string) => ({ role, scopeType, scopeId }) as any;
const estA = { groupId: "G1", level: "etablissement" as const, establishmentId: "A" }; // déclinaison de l'établissement A
const groupe = { groupId: "G1", level: "groupe" as const, sharedReadEstablishmentIds: ["A"] }; // objectif source du groupe

test("P1 droits — aucune écriture croisée sur une déclinaison", () => {
  // un établissement ne modifie ni la déclinaison d'un autre établissement ni l'objectif du groupe
  assert.equal(decide([asg("referent_etablissement", "etablissement", "B")], "modifier", estA).allowed, false);
  assert.equal(decide([asg("referent_etablissement", "etablissement", "A")], "modifier", groupe).allowed, false);
  assert.equal(decide([asg("referent_etablissement", "etablissement", "A")], "valider", groupe).allowed, false);
  assert.equal(decide([asg("referent_etablissement", "etablissement", "A")], "diffuser", groupe).allowed, false);
  // un autre groupe n'a aucun accès
  assert.equal(decide([asg("directeur", "groupe", "G2")], "voir", estA).allowed, false);
  // sans affectation : aucun accès
  assert.equal(decide([], "voir", estA).allowed, false);
});

test("P1 droits — le groupe consulte les déclinaisons sans les modifier ; l'établissement modifie la sienne", () => {
  for (const role of ["directeur", "administrateur", "chef_de_projet"]) {
    assert.equal(decide([asg(role, "groupe", "G1")], "voir", estA).allowed, true, role);
    assert.equal(decide([asg(role, "groupe", "G1")], "modifier", estA).allowed, false, role);
  }
  assert.equal(decide([asg("referent_etablissement", "etablissement", "A")], "modifier", estA).allowed, true);
  assert.equal(decide([asg("referent_etablissement", "etablissement", "A")], "voir", groupe).allowed, true); // objectif source en lecture
});

test("P1 droits — diffuser et décider d'une dérogation : directeur / administrateur du groupe seulement", () => {
  assert.equal(decide([asg("directeur", "groupe", "G1")], "diffuser", groupe).allowed, true);
  assert.equal(decide([asg("chef_de_projet", "groupe", "G1")], "diffuser", groupe).allowed, false);
  // le chef de projet de groupe a « valider » mais ne décide pas d'une dérogation (contrôle de rôle supplémentaire)
  const cdp = [asg("chef_de_projet", "groupe", "G1")];
  assert.equal(decide(cdp, "valider", groupe).allowed, true);
  assert.equal(canDecideDerogation(cdp, "G1"), false);
  assert.equal(canDecideDerogation([asg("directeur", "groupe", "G1")], "G1"), true);
  assert.equal(canDecideDerogation([asg("directeur", "groupe", "G2")], "G1"), false);
  assert.equal(canDecideDerogation([asg("referent_etablissement", "etablissement", "A")], "G1"), false);
});

const read = (p: string) => readFileSync(p, "utf8");

test("P1 non-écrasement — la synchronisation ne modifie ni ne supprime les données locales", () => {
  const src = read("src/lib/diffusionDb.ts");
  assert.ok(!/\.(delete|deleteMany|upsert)\(/.test(src), "aucune suppression ni upsert dans la synchronisation");
  // seules écritures autorisées sur un cycle existant : compléter le lien parent, passer l'ancienne portée « aucune » à « tous »
  const updates = [...src.matchAll(/strategicGoalCycle\.updateMany\(\{[^]*?data: (\{[^}]*\})/g)].map((m) => m[1].replace(/\s+/g, " "));
  assert.ok(updates.length >= 1);
  for (const d of updates) assert.ok(/^\{ (parentCycleId: r\.parentCycleId|diffusion: "tous") \}$/.test(d), `écriture inattendue : ${d}`);
  assert.ok(!/strategicGoalCycle\.update\(/.test(src), "aucun update de cycle individuel");
  // un établissement hors sélection ou hors périmètre n'est jamais recréé : création uniquement pour les destinataires
  assert.ok(src.includes("allowedEstablishments("));
  assert.ok(src.includes('miseEnOeuvre: "non_pris_en_charge"'));
});

test("P1 non-écrasement — la couche d'accès ne touche jamais cible, indicateurs, responsable ni statut local", () => {
  const src = read("src/lib/declinaisonDb.ts");
  // (les lignes d'appel de la règle pure et de réponse JSON ne sont pas des écritures en base)
  const writes = src.split("\n").filter((l) => !/applyDerogation\(|return \{ ok: true/.test(l)).join("\n");
  assert.ok(!/\b(cible|indicateurs|responsable|responsableActorId|statut)\s*:(?!\s*true)/.test(writes), "champ protégé écrit");
  assert.ok(!/\.(delete|upsert)\(/.test(src), "aucune suppression de ligne métier");
  const dels = [...src.matchAll(/prisma\.(\w+)\.deleteMany/g)].map((m) => m[1]);
  assert.deepEqual(dels, ["goalDiffusionTarget"], "seule la liste de destinataires (configuration) est remplacée");
  // « Accepter » ne recopie que des champs suivis non automatiques
  assert.ok(src.includes("fieldsToApply("));
});

test("P1 routes — rôle de décision et droit « valider » vérifiés pour valider / refuser / révoquer", () => {
  const src = read("src/app/api/objectives/[id]/derogation/route.ts");
  assert.ok(src.includes('"valider"') && src.includes("canDecideDerogation("));
  assert.ok(src.indexOf("guardRecord(") < src.indexOf("changeDerogation("), "garde avant écriture");
  const diff = read("src/app/api/objectives/[id]/diffuse/route.ts");
  assert.ok(diff.includes('"diffuser"'));
  const admin = read("src/app/api/admin/migrate-diffusion-states/route.ts");
  assert.ok(admin.includes('sp.get("apply") === "1"'), "simulation par défaut");
});
