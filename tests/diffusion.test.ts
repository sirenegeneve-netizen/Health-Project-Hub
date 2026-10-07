import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleIsDiffused, diffusionProgress, lockedFieldsTouched, LOCKED_GOAL_FIELDS, LOCKED_PLAN_FIELDS, missingChildren } from "../src/lib/diffusion";

test("copies manquantes : une par établissement sans copie, idempotent", () => {
  const first = missingChildren(["g1", "g2"], ["e1", "e2"], []);
  assert.equal(first.length, 4);
  const existing = [
    { ownerId: "e1", parentId: "g1" },
    { ownerId: "e2", parentId: "g1" },
    { ownerId: "e1", parentId: null }, // objectif propre à l'établissement : ignoré
  ];
  assert.deepEqual(missingChildren(["g1", "g2"], ["e1", "e2"], existing), [
    { establishmentId: "e1", parentId: "g2" },
    { establishmentId: "e2", parentId: "g2" },
  ]);
  // nouvel établissement : reçoit toutes les copies
  assert.deepEqual(missingChildren(["g1"], ["e1", "e2", "e3"], existing.slice(0, 2)), [{ establishmentId: "e3", parentId: "g1" }]);
  assert.deepEqual(missingChildren([], ["e1"], []), []);
  assert.deepEqual(missingChildren(["g1"], [], []), []);
});

test("verrouillage : libellé verrouillé sur l'héritage, cible et indicateurs libres", () => {
  assert.deepEqual(lockedFieldsTouched(true, { libelle: "x" }, LOCKED_GOAL_FIELDS), ["libelle"]);
  assert.deepEqual(lockedFieldsTouched(true, { libelle: "x", description: "y" }, LOCKED_GOAL_FIELDS), ["libelle", "description"]);
  assert.deepEqual(lockedFieldsTouched(false, { libelle: "x" }, LOCKED_GOAL_FIELDS), []);
  assert.deepEqual(lockedFieldsTouched(true, { startDate: "2026-01-01", statut: "clos" }, LOCKED_PLAN_FIELDS), ["startDate", "statut"]);
  assert.deepEqual(lockedFieldsTouched(true, { cible: "95 %", indicateurs: "taux" }, LOCKED_GOAL_FIELDS), []);
});

test("un cycle est diffusé quand l'objectif et le plan le sont", () => {
  assert.equal(cycleIsDiffused({ diffuse: true }, { diffuse: true }), true);
  assert.equal(cycleIsDiffused({ diffuse: true }, { diffuse: false }), false);
  assert.equal(cycleIsDiffused({ diffuse: false }, { diffuse: true }), false);
});

test("avancement de la déclinaison dans les établissements", () => {
  assert.deepEqual(
    diffusionProgress([
      { cible: "95 %", indicateurs: null },
      { cible: " ", indicateurs: "taux" },
      { cible: null, indicateurs: null },
    ]),
    { total: 3, withTarget: 1, withIndicators: 1 }
  );
});
