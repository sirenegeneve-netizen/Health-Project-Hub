import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUCUNE_POPULATION, PERIMETRES_ORGANISATIONNELS, POPULATIONS, THEMES_INDICATEUR,
  isTheme, normalizePopulations, sanitizeCodes, unknownCodes,
} from "../src/lib/referentiels";
import {
  baselineState, buildBaselineAction, effectiveIndicator, indicatorProgress, lockedIndicatorFields,
  needsBaseline, objectiveProgress, planBaselineAction, toNumberOrNull, validateObjectiveInput,
} from "../src/lib/objectifs";

test("nomenclatures : effectifs attendus et codes uniques", () => {
  assert.equal(PERIMETRES_ORGANISATIONNELS.length, 22);
  assert.equal(POPULATIONS.length, 19);
  assert.equal(THEMES_INDICATEUR.length, 8);
  for (const l of [PERIMETRES_ORGANISATIONNELS, POPULATIONS, THEMES_INDICATEUR]) assert.equal(new Set(l.map((i) => i.code)).size, l.length);
});

test("sélection multiple : codes inconnus rejetés, doublons retirés, ordre stable", () => {
  assert.deepEqual(sanitizeCodes(PERIMETRES_ORGANISATIONNELS, ["service_unite", "groupe", "groupe", "x"]), ["groupe", "service_unite"]);
  assert.deepEqual(unknownCodes(POPULATIONS, ["personnel_medical", "bidon"]), ["bidon"]);
  assert.equal(validateObjectiveInput({ libelle: "O", strategicPlanId: "p", populations: ["bidon"] }).length, 1);
  assert.equal(validateObjectiveInput({ libelle: "O", strategicPlanId: "p", populations: ["personnel_medical"], perimetreOrg: ["siege"] }).length, 0);
});

test("« Aucune population directe » est exclusive", () => {
  assert.deepEqual(normalizePopulations([AUCUNE_POPULATION, "personnel_medical"], ["personnel_medical"]), [AUCUNE_POPULATION]);
  assert.deepEqual(normalizePopulations([AUCUNE_POPULATION, "personnel_medical"], [AUCUNE_POPULATION]), ["personnel_medical"]);
  assert.deepEqual(normalizePopulations(["personnel_medical", "personnel_soignant"]), ["personnel_medical", "personnel_soignant"]);
});

test("thème : liste contrôlée à sélection unique, facultatif mais validé", () => {
  assert.ok(isTheme("conformite_reglementation"));
  assert.ok(!isTheme("Conformité")); // on stocke les codes, pas les libellés
  assert.equal(validateObjectiveInput({ libelle: "O", strategicPlanId: "p", indicators: [{ nom: "I", theme: "inconnu" }] }).length, 1);
  assert.equal(validateObjectiveInput({ libelle: "O", strategicPlanId: "p", indicators: [{ nom: "I", theme: "qualite_performance" }, { nom: "J" }] }).length, 0);
});

test("le thème fait partie de la définition héritée du groupe (verrouillé sur la copie établissement)", () => {
  assert.deepEqual(lockedIndicatorFields(true, { theme: "strategique", valeurInitiale: 3 }), ["theme"]);
  const parent = { nom: "N", description: null, unite: "%", sens: "hausse", frequence: "annuelle", theme: "strategique", valeurInitiale: null, valeurCible: 90 };
  const child = { ...parent, theme: null, valeurCible: null };
  assert.equal(effectiveIndicator(child, parent).theme, "strategique");
});

test("valeur initiale : inconnue ≠ zéro", () => {
  assert.equal(toNumberOrNull("0"), 0);
  assert.equal(toNumberOrNull(""), null);
  assert.equal(needsBaseline(0), false);
  assert.equal(needsBaseline("0"), false);
  assert.equal(needsBaseline(null), true);
  assert.equal(needsBaseline(""), true);
  assert.equal(baselineState({ valeurInitiale: 0 }), "etablie");
  assert.equal(baselineState({ valeurInitiale: null }), "a_etablir");
  assert.equal(baselineState({ valeurInitiale: null, baselines: [{ statut: "propose" }] }), "a_valider");
});

test("aucune progression artificielle tant que la valeur initiale est inconnue ; zéro est exploitable", () => {
  assert.equal(indicatorProgress({ valeurInitiale: null, valeurCible: 100, actuelle: 40 }), null);
  assert.equal(indicatorProgress({ valeurInitiale: 0, valeurCible: 100, actuelle: 40 }), 0.4);
  assert.equal(objectiveProgress({ indicators: [{ progress: null }], actions: [{ status: "termine" }] }).percent, null);
});

test("action d'état des lieux : une seule par objectif, au bon niveau", () => {
  // plusieurs indicateurs, certains seulement sans valeur initiale
  const inds = [{ nom: "A", valeurInitiale: null }, { nom: "B", valeurInitiale: 12 }, { nom: "C", valeurInitiale: "" }, { nom: "D", valeurInitiale: 0 }];
  assert.deepEqual(planBaselineAction({ indicators: inds, wanted: true }), { indexes: [0, 2], create: true, reuseActionId: null });
  // situation déjà documentée : aucune action
  assert.deepEqual(planBaselineAction({ indicators: [{ nom: "B", valeurInitiale: 12 }, { nom: "D", valeurInitiale: 0 }], wanted: true }), { indexes: [], create: false, reuseActionId: null });
  // l'utilisateur renonce
  assert.equal(planBaselineAction({ indicators: inds, wanted: false }).create, false);
  // action existante : réutilisée, pas de doublon
  assert.deepEqual(planBaselineAction({ indicators: inds, wanted: true, existingActionId: "a1" }), { indexes: [0, 2], create: false, reuseActionId: "a1" });
  // indicateur sans nom ignoré
  assert.deepEqual(planBaselineAction({ indicators: [{ nom: " ", valeurInitiale: null }], wanted: true }).indexes, []);
});

test("texte prérempli de l'action d'état des lieux", () => {
  const one = buildBaselineAction({ objectif: "Améliorer la sécurité informatique", indicators: [{ nom: "Pourcentage d'établissements conformes" }], ownerType: "groupe" });
  assert.match(one.title, /audit de départ — Pourcentage d'établissements conformes/);
  assert.match(one.description, /pour chaque établissement concerné/);
  assert.match(one.livrable, /valeur initiale consolidée et justifiée/);
  const many = buildBaselineAction({ objectif: "Obj", indicators: [{ nom: "A" }, { nom: "B" }], ownerType: "etablissement" });
  assert.match(many.title, /— Obj$/);
  assert.match(many.description, /« A », « B »/);
  assert.doesNotMatch(many.description, /chaque établissement/);
});
