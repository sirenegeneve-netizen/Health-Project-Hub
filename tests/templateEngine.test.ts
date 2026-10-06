// Tests purs (sans base de données) du moteur de modèles : données de départ et règles de planification.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_TYPES,
  STAGE_LIBRARY,
  STAGE_OVERRIDES,
  TYPE_PARCOURS,
  buildTemplateSpec,
  buildGeneralTemplateSpec,
  parseStageToken,
} from "../src/lib/templateSeedData";
import { planInstance, templateOptionsForType, canEditInPlace, nextVersion, moveInOrder, uniqueKey, slugifyKey, evaluateStageExit } from "../src/lib/templatePlan";

test("les types : 36, clés uniques, clés historiques conservées, « autre » devient Personnalisé", () => {
  assert.equal(PROJECT_TYPES.length, 36);
  assert.equal(new Set(PROJECT_TYPES.map((t) => t.key)).size, 36);
  for (const k of ["deploiement", "evolution", "interoperabilite", "migration", "mise_a_niveau", "cybersecurite", "reglementaire", "formation", "audit", "autre"]) {
    assert.ok(PROJECT_TYPES.some((t) => t.key === k), `clé historique manquante : ${k}`);
  }
  assert.equal(PROJECT_TYPES.find((t) => t.key === "autre")?.label, "Personnalisé");
});

test("chaque type a un parcours, et chaque étape de parcours existe dans la bibliothèque", () => {
  for (const t of PROJECT_TYPES) {
    const parcours = TYPE_PARCOURS[t.key];
    assert.ok(parcours && parcours.length >= 4, `parcours manquant ou trop court : ${t.key}`);
    const keys = parcours.map((tok) => parseStageToken(tok).key);
    assert.equal(new Set(keys).size, keys.length, `étape en double dans ${t.key}`);
    for (const k of keys) assert.ok(STAGE_LIBRARY[k], `étape inconnue ${k} dans ${t.key}`);
    assert.equal(keys[keys.length - 1], "cloture", `${t.key} doit finir par la clôture`);
  }
});

test("les surcharges Modèle × Étape visent des étapes et types existants", () => {
  for (const k of Object.keys(STAGE_OVERRIDES)) {
    const [stage, type] = k.split(":");
    assert.ok(STAGE_LIBRARY[stage], `étape inconnue dans la surcharge ${k}`);
    assert.ok(TYPE_PARCOURS[type], `type inconnu dans la surcharge ${k}`);
    assert.ok(TYPE_PARCOURS[type].some((tok) => parseStageToken(tok).key === stage), `la surcharge ${k} vise une étape absente du parcours`);
  }
});

test("parcours demandés dans la spécification", () => {
  const labels = (t: string) => buildTemplateSpec(t).stages.map((s) => s.label);
  assert.deepEqual(labels("deploiement"), ["Kick-off", "Cadrage", "Préparation", "Déploiement", "Validation", "Formation & Accompagnement", "Mise en production", "Stabilisation", "Clôture"]);
  assert.deepEqual(labels("migration"), ["Kick-off", "Cadrage", "Analyse des données", "Préparation", "Migration pilote", "Contrôles", "Migration", "Validation", "Stabilisation", "Clôture"]);
  assert.deepEqual(labels("interoperabilite"), ["Kick-off", "Cadrage", "Analyse des flux", "Spécifications", "Réalisation", "Tests d'intégration", "Validation", "Mise en production", "Surveillance", "Clôture"]);
  assert.deepEqual(labels("formation"), ["Analyse du besoin", "Conception", "Préparation", "Formation", "Évaluation", "Accompagnement", "Clôture"]);
});

test("une même étape a un contenu différent selon le type (Validation)", () => {
  const crit = (t: string) => buildTemplateSpec(t).stages.find((s) => s.key === "validation")!.criteria.map((c) => c.label);
  assert.ok(crit("deploiement").includes("Recette métier validée"));
  assert.ok(crit("migration").includes("Données source/cible rapprochées"));
  assert.ok(crit("interoperabilite").includes("Tests bout-en-bout réalisés"));
  assert.notDeepEqual(crit("deploiement"), crit("migration"));
});

test("le Kick-off est optionnel pour l'audit, absent de la formation, obligatoire pour le déploiement", () => {
  const ko = (t: string) => buildTemplateSpec(t).stages.find((s) => s.key === "kickoff");
  assert.equal(ko("audit")?.obligatoire, false);
  assert.equal(ko("formation"), undefined);
  assert.equal(ko("deploiement")?.obligatoire, true);
});

test("critères historiques conservés : les 4 critères de Kick-off, et les listes déjà saisies priment", () => {
  const k = buildTemplateSpec("deploiement").stages.find((s) => s.key === "kickoff")!;
  assert.deepEqual(k.criteria.map((c) => c.label), ["Support de Kick-off préparé", "Compte rendu diffusé", "Planning confirmé avec les parties prenantes", "Responsabilités confirmées"]);
  const custom = buildTemplateSpec("migration", { migration: { preparation: ["Critère saisi par l'administrateur"] } });
  assert.deepEqual(custom.stages.find((s) => s.key === "preparation")!.criteria.map((c) => c.label), ["Critère saisi par l'administrateur"]);
  const viaDefault = buildTemplateSpec("migration", { defaut: { cloture: ["Clôture personnalisée"] } });
  assert.deepEqual(viaDefault.stages.find((s) => s.key === "cloture")!.criteria.map((c) => c.label), ["Clôture personnalisée"]);
});

test("modèle général", () => {
  const g = buildGeneralTemplateSpec();
  assert.equal(g.isGeneral, true);
  assert.equal(g.stages.find((s) => s.key === "kickoff")!.criteria.length, 4);
});

test("instanciation : étapes actives seulement, ordre et position recalculés, phase initiale = 1re étape active", () => {
  const mk = (id: string, position: number, key: string, active: boolean) => ({
    id, position, key, label: key, objectif: null, obligatoire: true, active, legacyPhases: [], gateMode: null,
    criteria: [{ label: `c-${key}-2`, order: 1, obligatoire: true, mode: "manuel", autoSource: null }, { label: `c-${key}-1`, order: 0, obligatoire: false, mode: "manuel", autoSource: null }],
  });
  const plan = planInstance([mk("c", 2, "c", true), mk("a", 0, "a", false), mk("b", 1, "b", true)]);
  assert.deepEqual(plan.stages.map((s) => [s.key, s.position]), [["b", 0], ["c", 1]]);
  assert.equal(plan.firstPhase, "b");
  assert.deepEqual(plan.stages[0].criteria.map((c) => c.label), ["c-b-1", "c-b-2"]);
  assert.equal(planInstance([]).firstPhase, null);
});

test("sélection du modèle : un seul actif → auto ; plusieurs → choix ; aucun → modèle général", () => {
  const t = (id: string, typeKey: string, familyId: string, version: number, status: string, isGeneral = false) => ({ id, typeKey, familyId, name: id, version, status, isGeneral });
  const all = [t("d1", "deploiement", "f1", 1, "archive"), t("d2", "deploiement", "f1", 2, "actif"), t("g", "defaut", "std-defaut", 1, "actif", true)];
  assert.equal(templateOptionsForType(all, "deploiement").autoSelectedId, "d2");
  const two = [...all, t("dpi", "deploiement", "f2", 1, "actif")];
  const r = templateOptionsForType(two, "deploiement");
  assert.equal(r.options.length, 2);
  assert.equal(r.autoSelectedId, null);
  const none = templateOptionsForType(all, "audit");
  assert.equal(none.options.length, 0);
  assert.equal(none.fallbackGeneralId, "g");
  assert.equal(templateOptionsForType([t("b", "audit", "f", 1, "brouillon")], "audit").options.length, 0);
});

test("versionnage : jamais d'édition en place d'un modèle utilisé", () => {
  assert.equal(canEditInPlace({ status: "actif" }, 3), false);
  assert.equal(canEditInPlace({ status: "brouillon" }, 1), false);
  assert.equal(canEditInPlace({ status: "brouillon" }, 0), true);
  assert.equal(canEditInPlace({ status: "archive" }, 0), false);
  assert.equal(nextVersion([1, 2]), 3);
  assert.equal(nextVersion([]), 1);
});

test("utilitaires : déplacement, clés", () => {
  assert.deepEqual(moveInOrder(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.equal(moveInOrder(["a", "b"], "a", "up"), null);
  assert.equal(slugifyKey("Revue d'architecture & sécurité"), "revue_d_architecture_securite");
  assert.equal(uniqueKey("tests", new Set(["tests", "tests_2"])), "tests_3");
});

test("Gate : consultatif par défaut (alerte mais passage possible), bloquant en option", () => {
  const crit = [{ obligatoire: true, status: "pret" }, { obligatoire: true, status: "en_cours" }, { obligatoire: false, status: "non_commence" }];
  assert.deepEqual(evaluateStageExit(null, crit), { unmet: 1, allowed: true, warning: true });
  assert.deepEqual(evaluateStageExit("consultatif", crit), { unmet: 1, allowed: true, warning: true });
  assert.deepEqual(evaluateStageExit("bloquant", crit), { unmet: 1, allowed: false, warning: true });
  assert.deepEqual(evaluateStageExit("bloquant", [{ obligatoire: true, status: "pret" }]), { unmet: 0, allowed: true, warning: false });
});

// ---------------------------------------------------------------------------------------------
// Lot 2
// ---------------------------------------------------------------------------------------------
import {
  STAGE_ITEMS,
  STAGE_GATES,
  AUTO_CRITERIA,
} from "../src/lib/templateSeedData";
import {
  AUTO_SOURCES,
  ITEM_KINDS,
  evaluateAutoSource,
  evaluateGate,
  expectedItemState,
  gateDecisionAllowed,
  nextCriterionStatus,
  nextStageKey,
  phaseChangeAllowed,
  isAutoSource,
  type StageFacts,
} from "../src/lib/templatePlan";

const cleanFacts: StageFacts = { openBlockingRisks: 0, blockingAnomalies: 0, overdueActions: 0, requiredDeliverablesMissing: 0, requiredDecisionsMissing: 0, requiredActionsMissing: 0 };

test("Lot 2 — les éléments attendus et Gates du seed visent des étapes et types existants", () => {
  for (const table of [STAGE_ITEMS, STAGE_GATES]) {
    for (const k of Object.keys(table)) {
      const [stage, type] = k.split(":");
      assert.ok(STAGE_LIBRARY[stage], `étape inconnue : ${k}`);
      if (type !== "*") assert.ok(TYPE_PARCOURS[type]?.some((tok) => parseStageToken(tok).key === stage), `${k} vise une étape absente du parcours`);
    }
  }
  for (const items of Object.values(STAGE_ITEMS)) for (const it of items) assert.ok((ITEM_KINDS as readonly string[]).includes(it.kind));
  for (const [k, v] of Object.entries(AUTO_CRITERIA)) {
    assert.ok(isAutoSource(v.source), `source inconnue : ${v.source}`);
    const [stage, ...rest] = k.split(":");
    const label = rest.join(":");
    assert.ok(STAGE_LIBRARY[stage].criteria.includes(label) || Object.values(STAGE_OVERRIDES).some((o) => o.criteria?.includes(label)), `critère automatique introuvable : ${k}`);
  }
});

test("Lot 2 — contenu : Validation Déploiement, Gate bloquant cyber/réglementaire, Gate consultatif de mise en production", () => {
  const val = buildTemplateSpec("deploiement").stages.find((s) => s.key === "validation")!;
  assert.deepEqual(val.items.filter((i) => i.kind === "livrable").map((i) => i.label), ["Rapport de tests", "Cahier de recette", "PV de recette"]);
  assert.equal(val.criteria.find((c) => c.label === "Anomalies bloquantes résolues")?.mode, "auto");
  assert.equal(buildTemplateSpec("cybersecurite").stages.find((s) => s.key === "validation")!.gateMode, "bloquant");
  assert.equal(buildTemplateSpec("reglementaire").stages.find((s) => s.key === "validation")!.gateMode, "bloquant");
  assert.equal(buildTemplateSpec("deploiement").stages.find((s) => s.key === "mise_en_production")!.gateMode, "consultatif");
  assert.equal(buildTemplateSpec("deploiement").stages.find((s) => s.key === "deploiement")!.gateMode, null);
  const mig = buildTemplateSpec("migration").stages.find((s) => s.key === "validation")!;
  assert.ok(mig.items.some((i) => i.label === "Rapport de rapprochement source/cible"));
  assert.ok(!mig.items.some((i) => i.label === "Rapport de tests"));
});

test("Lot 2 — état d'un élément attendu", () => {
  const livrable = { kind: "livrable" as const, label: "PV de recette", obligatoire: true };
  assert.equal(expectedItemState(livrable, []), "missing");
  assert.equal(expectedItemState(livrable, [{ label: " pv de recette ", status: "en_cours" }]), "in_progress");
  assert.equal(expectedItemState(livrable, [{ label: "PV de recette", status: "valide" }]), "done");
  assert.equal(expectedItemState({ kind: "decision", label: "Go", obligatoire: true }, [{ label: "Go", status: "decision_prise" }]), "done");
  assert.equal(expectedItemState({ kind: "risque", label: "R", obligatoire: false }, [{ label: "R", status: "ouvert" }]), "done");
  assert.equal(expectedItemState({ kind: "role", label: "Sponsor", obligatoire: false }, []), "untracked");
});

test("Lot 2 — sources automatiques et statut des critères", () => {
  assert.equal(evaluateAutoSource("risks.noBlockingOpen", cleanFacts), true);
  assert.equal(evaluateAutoSource("risks.noBlockingOpen", { ...cleanFacts, openBlockingRisks: 2 }), false);
  assert.equal(evaluateAutoSource("source.inconnue", cleanFacts), null);
  assert.ok(Object.keys(AUTO_SOURCES).length >= 6);
  // manuel : jamais touché
  assert.equal(nextCriterionStatus("manuel", "en_cours", true), "en_cours");
  // auto : suit la source, sauf « bloqué » posé à la main
  assert.equal(nextCriterionStatus("auto", "non_commence", true), "pret");
  assert.equal(nextCriterionStatus("auto", "pret", false), "en_cours");
  assert.equal(nextCriterionStatus("auto", "bloque", true), "bloque");
  assert.equal(nextCriterionStatus("auto", "non_commence", false), "non_commence");
  // hybride : propose « prêt » seulement, ne rétrograde jamais
  assert.equal(nextCriterionStatus("hybride", "en_cours", true), "pret");
  assert.equal(nextCriterionStatus("hybride", "bloque", true), "bloque");
  assert.equal(nextCriterionStatus("hybride", "pret", false), "pret");
  assert.equal(nextCriterionStatus("auto", "en_cours", null), "en_cours");
});

test("Lot 2 — Gate : conditions, consultatif vs bloquant, décisions", () => {
  const crit = [{ obligatoire: true, status: "pret" }, { obligatoire: true, status: "en_cours" }];
  const consultatif = evaluateGate({ gateMode: "consultatif", criteria: crit, facts: { ...cleanFacts, openBlockingRisks: 1 } });
  assert.equal(consultatif.unmet, 2);
  assert.equal(consultatif.allowed, true);
  assert.equal(consultatif.warning, true);
  assert.deepEqual(consultatif.conditions.filter((c) => !c.met).map((c) => c.key), ["criteres", "risques"]);
  const bloquant = evaluateGate({ gateMode: "bloquant", criteria: crit, facts: cleanFacts });
  assert.equal(bloquant.allowed, false);
  const ok = evaluateGate({ gateMode: "bloquant", criteria: [{ obligatoire: true, status: "pret" }], facts: cleanFacts });
  assert.equal(ok.allowed, true);
  assert.equal(ok.warning, false);
  assert.equal(evaluateGate({ gateMode: null, criteria: [], facts: cleanFacts }).mode, "aucun");

  assert.deepEqual(gateDecisionAllowed("go", consultatif), { ok: true, advance: true });
  assert.deepEqual(gateDecisionAllowed("go_reserves", bloquant), { ok: false, advance: false, reason: "Gate bloquant : les conditions de passage ne sont pas toutes réunies." });
  assert.deepEqual(gateDecisionAllowed("no_go", bloquant), { ok: true, advance: false });
});

test("Lot 2 — garde du changement de phase (bloquant uniquement, uniquement en avant)", () => {
  const keys = ["a", "b", "c"];
  const blocked = evaluateGate({ gateMode: "bloquant", criteria: [{ obligatoire: true, status: "non_commence" }], facts: cleanFacts });
  assert.equal(phaseChangeAllowed({ orderedKeys: keys, fromKey: "b", toKey: "c", fromGateMode: "bloquant", evaluation: blocked }), false);
  assert.equal(phaseChangeAllowed({ orderedKeys: keys, fromKey: "b", toKey: "a", fromGateMode: "bloquant", evaluation: blocked }), true);
  assert.equal(phaseChangeAllowed({ orderedKeys: keys, fromKey: "b", toKey: "c", fromGateMode: "consultatif", evaluation: blocked }), true);
  assert.equal(phaseChangeAllowed({ orderedKeys: keys, fromKey: null, toKey: "c", fromGateMode: "bloquant", evaluation: blocked }), true);
  assert.equal(nextStageKey(keys, "b"), "c");
  assert.equal(nextStageKey(keys, "c"), null);
});

test("Lot 2 — instanciation : les éléments attendus sont copiés (figés) avec le parcours", () => {
  const stage = {
    id: "s1", position: 0, key: "validation", label: "Validation", objectif: null, obligatoire: true, active: true, legacyPhases: [], gateMode: "bloquant",
    criteria: [],
    items: [{ kind: "livrable", label: "B", order: 1, obligatoire: false }, { kind: "livrable", label: "A", order: 0, obligatoire: true }],
  };
  const plan = planInstance([stage]);
  assert.deepEqual(plan.stages[0].expected, [{ kind: "livrable", label: "A", obligatoire: true }, { kind: "livrable", label: "B", obligatoire: false }]);
  assert.equal(plan.stages[0].gateMode, "bloquant");
});
