import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicableEstablishmentIds,
  conformiteSummary,
  currentValue,
  effectiveIndicator,
  formatProgress,
  formatTarget,
  indicatorProgress,
  lockedIndicatorFields,
  objectiveProgress,
  resolveParentCycleId,
  rollupProgress,
  toNumberOrNull,
  validateObjectiveInput,
} from "../src/lib/objectifs";

test("valeur actuelle = dernière mesure ; aucune mesure → null", () => {
  assert.equal(currentValue([]), null);
  assert.equal(currentValue([{ valeur: 82, dateMesure: "2026-01-01" }, { valeur: 91, dateMesure: "2026-06-01" }, { valeur: 88, dateMesure: "2026-03-01" }]), 91);
  // même date : la dernière saisie l'emporte
  assert.equal(currentValue([{ valeur: 1, dateMesure: "2026-01-01", createdAt: "2026-01-02" }, { valeur: 2, dateMesure: "2026-01-01", createdAt: "2026-01-03" }]), 2);
});

test("progression d'un indicateur : calculée seulement si initiale, cible et mesure existent", () => {
  assert.equal(indicatorProgress({ valeurInitiale: 82, valeurCible: 98, actuelle: 90 }), 0.5);
  assert.equal(indicatorProgress({ valeurInitiale: 82, valeurCible: 98, actuelle: 120 }), 1); // bornée
  assert.equal(indicatorProgress({ valeurInitiale: 82, valeurCible: 98, actuelle: 70 }), 0); // bornée
  assert.equal(indicatorProgress({ valeurInitiale: 10, valeurCible: 2, actuelle: 6 }), 0.5); // à la baisse
  assert.equal(indicatorProgress({ valeurInitiale: null, valeurCible: 98, actuelle: 90 }), null);
  assert.equal(indicatorProgress({ valeurInitiale: 82, valeurCible: null, actuelle: 90 }), null);
  assert.equal(indicatorProgress({ valeurInitiale: 82, valeurCible: 98, actuelle: null }), null); // indicateur sans mesure
  assert.equal(indicatorProgress({ valeurInitiale: 5, valeurCible: 5, actuelle: 5 }), null); // division par zéro évitée
});

test("progression d'un objectif — les cinq cas validés", () => {
  // objectif sans indicateur et sans action → « — »
  assert.deepEqual(objectiveProgress({ indicators: [], actions: [] }), { percent: null, basis: null, measured: 0, total: 0 });
  // objectif avec indicateur mais aucune mesure → « — » (pas de repli sur les actions)
  assert.deepEqual(objectiveProgress({ indicators: [{ progress: null }], actions: [{ status: "termine" }] }), { percent: null, basis: "indicateurs", measured: 0, total: 1 });
  // objectif avec mesures → progression calculée sur les indicateurs mesurés
  assert.deepEqual(objectiveProgress({ indicators: [{ progress: 0.5 }, { progress: 1 }, { progress: null }], actions: [] }), { percent: 75, basis: "indicateurs", measured: 2, total: 3 });
  // objectif sans indicateur mais avec actions → actions terminées / actions non abandonnées
  assert.deepEqual(objectiveProgress({ indicators: [], actions: [{ status: "termine" }, { status: "a_faire" }, { status: "en_cours" }, { status: "abandonne" }] }), { percent: 33, basis: "actions", measured: 1, total: 3 });
  // actions toutes abandonnées → « — »
  assert.equal(objectiveProgress({ indicators: [], actions: [{ status: "abandonne" }] }).percent, null);
  // indicateur abandonné ignoré
  assert.equal(objectiveProgress({ indicators: [{ progress: 1, statut: "abandonne" }], actions: [{ status: "termine" }, { status: "a_faire" }] }).basis, "actions");
  assert.equal(formatProgress({ percent: null }), "—");
  assert.equal(formatProgress({ percent: 70 }), "70 %");
});

test("synthèse d'un objectif de groupe : moyenne des établissements mesurés", () => {
  assert.deepEqual(rollupProgress([{ percent: 50 }, { percent: 100 }, { percent: null }]), { percent: 75, measured: 2, total: 3 });
  assert.deepEqual(rollupProgress([{ percent: null }]), { percent: null, measured: 0, total: 1 });
  assert.deepEqual(rollupProgress([]), { percent: null, measured: 0, total: 0 });
});

test("cible affichée", () => {
  assert.equal(formatTarget({ valeurCible: 98, sens: "hausse", unite: "%" }), "≥ 98 %");
  assert.equal(formatTarget({ valeurCible: 2.5, sens: "baisse", unite: "jours" }), "≤ 2,5 jours");
  assert.equal(formatTarget({ valeurCible: null, sens: "hausse", unite: null }), null);
  assert.equal(formatTarget(null), null);
});

test("indicateur établissement : définition héritée du groupe, cible locale facultative", () => {
  const parent = { nom: "Taux de traçabilité", description: "d", unite: "%", sens: "hausse", frequence: "mensuelle", valeurInitiale: null, valeurCible: 98 };
  const child = { nom: "AUTRE NOM", description: null, unite: null, sens: "baisse", frequence: "annuelle", valeurInitiale: 80, valeurCible: null };
  const e1 = effectiveIndicator(child, parent);
  assert.equal(e1.nom, "Taux de traçabilité");
  assert.equal(e1.sens, "hausse");
  assert.equal(e1.valeurCible, 98);
  assert.equal(e1.cibleHeritee, true);
  assert.equal(e1.valeurInitiale, 80); // valeur initiale propre
  const e2 = effectiveIndicator({ ...child, valeurCible: 95 }, parent);
  assert.equal(e2.valeurCible, 95);
  assert.equal(e2.cibleLocale, true);
  assert.equal(effectiveIndicator(parent, null).cibleHeritee, false);
  assert.deepEqual(lockedIndicatorFields(true, { nom: "x", unite: "y", valeurInitiale: 3 }), ["nom", "unite"]);
  assert.deepEqual(lockedIndicatorFields(true, { valeurInitiale: 3, valeurCible: 90 }), []);
  assert.deepEqual(lockedIndicatorFields(false, { nom: "x" }), []);
});

test("rattachement explicite au cycle parent : jamais deviné", () => {
  const groupCycles = [{ id: "c1", goalId: "g1", planId: "p1" }, { id: "c2", goalId: "g1", planId: "p2" }];
  assert.equal(resolveParentCycleId({ goalParentId: "g1", planParentId: "p2" }, groupCycles), "c2");
  assert.equal(resolveParentCycleId({ goalParentId: "g1", planParentId: "p9" }, groupCycles), null);
  assert.equal(resolveParentCycleId({ goalParentId: null, planParentId: "p1" }, groupCycles), null);
  assert.equal(resolveParentCycleId({ goalParentId: "g1", planParentId: "p1" }, [...groupCycles, { id: "c3", goalId: "g1", planId: "p1" }]), null);
});

test("applicabilité des exigences : tout le groupe, sélection, exclusions", () => {
  const all = ["e1", "e2", "e3"];
  assert.deepEqual(applicableEstablishmentIds("tous", [], all), ["e1", "e2", "e3"]);
  assert.deepEqual(applicableEstablishmentIds("tous", [{ establishmentId: "e2", applicable: false }], all), ["e1", "e3"]);
  assert.deepEqual(applicableEstablishmentIds("selection", [], all), []);
  assert.deepEqual(applicableEstablishmentIds("selection", [{ establishmentId: "e3", applicable: true }, { establishmentId: "e1", applicable: false }], all), ["e3"]);
  assert.deepEqual(conformiteSummary(["conforme", "non_conforme", "non_evalue", "conforme", "partiellement_conforme"]), { total: 5, conforme: 2, nonConforme: 1, partiel: 1, nonEvalue: 1 });
});

test("validation de la création d'un objectif : actions et indicateurs facultatifs", () => {
  assert.deepEqual(validateObjectiveInput({ libelle: "Améliorer la sécurité médicamenteuse", strategicPlanId: "p1" }), []);
  assert.ok(validateObjectiveInput({ strategicPlanId: "p1" }).includes("L'intitulé est requis."));
  assert.ok(validateObjectiveInput({ libelle: "x" }).includes("Le plan stratégique est requis."));
  assert.ok(validateObjectiveInput({ libelle: "x", strategicPlanId: "p", priorite: "urgente" }).includes("Priorité invalide."));
  const withInd = { libelle: "x", strategicPlanId: "p", indicators: [{ nom: "Taux", sens: "hausse", valeurInitiale: "82", valeurCible: "98,5" }], actions: [{ title: "État des lieux", indicatorIndex: 0 }] };
  assert.deepEqual(validateObjectiveInput(withInd), []);
  const bad = validateObjectiveInput({ libelle: "x", strategicPlanId: "p", indicators: [{ nom: "", valeurCible: "abc" }], actions: [{ title: " ", indicatorIndex: 3 }] });
  assert.equal(bad.length, 4);
  assert.equal(toNumberOrNull("98,5"), 98.5);
  assert.equal(toNumberOrNull(""), null);
  assert.ok(Number.isNaN(toNumberOrNull("abc") as number));
});
