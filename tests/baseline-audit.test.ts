import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSuggestClosure, consolidateAudits, correctiveActionDraft, emptyContenu, isBaselineAction, parseMeasureValue,
  sanitizeContenu, sanitizeMeasures, scopeAuditStatus, scopeKeyOf, validateAuditForValidation, type AuditMeasureInput,
} from "../src/lib/baselineAudit";

const okMeasure = (over: Partial<AuditMeasureInput> = {}): AuditMeasureInput => ({ goalIndicatorId: "i1", resultat: "mesuree", valeur: 42, dateReference: "2026-09-30", methodeCalcul: "x/y", source: "audit interne", commentaire: "", ...over });
const base = (over: any = {}) => ({
  dateRealisation: "2026-10-01", auditeur: "A. Martin", indicatorIds: ["i1"], measures: [okMeasure()],
  contenu: { ...emptyContenu(), synthese: "ok", besoinActions: "non" as const }, ...over,
});

test("l'action de départ est reconnue par son origine", () => {
  assert.ok(isBaselineAction({ origine: "etat_des_lieux" }));
  assert.ok(!isBaselineAction({ origine: "manuel" }));
  assert.ok(!isBaselineAction({ origine: null }));
});

test("valeur : vide ≠ zéro ; 0 est valide ; texte invalide signalé", () => {
  assert.equal(parseMeasureValue(""), null);
  assert.equal(parseMeasureValue(null), null);
  assert.equal(parseMeasureValue("0"), 0);
  assert.equal(parseMeasureValue("12,5"), 12.5);
  assert.ok(Number.isNaN(parseMeasureValue("abc")));
});

test("mesures : indicateurs inconnus ignorés, aucune valeur conservée sans résultat « mesurée »", () => {
  const { measures, errors } = sanitizeMeasures([
    { goalIndicatorId: "i1", resultat: "indeterminee", valeur: "50", commentaire: "données incomplètes" },
    { goalIndicatorId: "intrus", resultat: "mesuree", valeur: 1 },
    { goalIndicatorId: "i2", resultat: "mesuree", valeur: "0", source: "s" },
  ], ["i1", "i2"]);
  assert.equal(errors.length, 0);
  assert.equal(measures.length, 2);
  assert.equal(measures[0].valeur, null);
  assert.equal(measures[1].valeur, 0); // zéro conservé comme vraie valeur
  assert.equal(sanitizeMeasures([{ goalIndicatorId: "i1", resultat: "mesuree", valeur: "x" }], ["i1"]).errors.length, 1);
});

test("contenu : liste blanche, textes bornés, ids serveur non repris du client", () => {
  const c = sanitizeContenu({ synthese: " ok ", methodes: ["entretiens", "bidon", "entretiens"], constats: [{ type: "zzz", libelle: "L" }], findingIds: ["forge"], extra: 1 }, { findingIds: ["f1"] });
  assert.equal(c.synthese, "ok");
  assert.deepEqual(c.methodes, ["entretiens"]);
  assert.equal(c.constats[0].type, "observation");
  assert.deepEqual(c.findingIds, ["f1"]);
  assert.ok(!("extra" in c));
});

test("validation d'un audit complet : aucune erreur ; zéro mesuré accepté", () => {
  assert.deepEqual(validateAuditForValidation(base()), []);
  assert.deepEqual(validateAuditForValidation(base({ measures: [okMeasure({ valeur: 0 })] })), []);
});

test("validation refusée tant que la mesure n'est pas suffisamment documentée", () => {
  assert.ok(validateAuditForValidation(base({ measures: [okMeasure({ valeur: null })] })).some((e) => /numérique/.test(e)));
  assert.ok(validateAuditForValidation(base({ measures: [okMeasure({ source: "" })] })).some((e) => /source/.test(e)));
  assert.ok(validateAuditForValidation(base({ measures: [okMeasure({ dateReference: null })] })).some((e) => /date de référence/.test(e)));
  assert.ok(validateAuditForValidation(base({ measures: [okMeasure({ methodeCalcul: "", commentaire: "" })] })).some((e) => /méthode/.test(e)));
  assert.ok(validateAuditForValidation(base({ auditeur: " " })).some((e) => /auditeur/i.test(e)));
});

test("audit réalisé sans valeur exploitable : valide si le commentaire l'explique ; audit non réalisé : refusé", () => {
  const indet = okMeasure({ resultat: "indeterminee", valeur: null, source: "", methodeCalcul: "", commentaire: "données non disponibles" });
  assert.deepEqual(validateAuditForValidation(base({ measures: [indet] })), []);
  assert.ok(validateAuditForValidation(base({ measures: [{ ...indet, commentaire: "" }] })).some((e) => /indéterminée/.test(e)));
  assert.ok(validateAuditForValidation(base({ measures: [okMeasure({ resultat: "non_realisee", valeur: null })] })).some((e) => /brouillon/.test(e)));
  assert.ok(validateAuditForValidation(base({ measures: [] })).some((e) => /brouillon/.test(e)));
});

test("plusieurs indicateurs : seuls ceux évalués sont contrôlés", () => {
  const e = validateAuditForValidation(base({ indicatorIds: ["i1", "i2"], measures: [okMeasure(), okMeasure({ goalIndicatorId: "i2", resultat: "non_realisee", valeur: null })] }));
  assert.deepEqual(e, []);
});

test("consolidation : trois situations distinctes, aucune valeur agrégée", () => {
  const ests = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" }];
  const c = consolidateAudits(ests, [
    { establishmentId: "a", statut: "valide", measures: [{ resultat: "mesuree" }] },
    { establishmentId: "b", statut: "valide", measures: [{ resultat: "indeterminee" }] },
    { establishmentId: "c", statut: "brouillon", measures: [] },
  ]);
  assert.deepEqual(c.rows.map((r) => r.status), ["mesure_validee", "evalue_sans_resultat", "brouillon", "non_evalue"]);
  assert.deepEqual(c.counts, { non_evalue: 1, brouillon: 1, evalue_sans_resultat: 1, mesure_validee: 1 });
  assert.equal(c.total, 4);
  assert.equal(scopeAuditStatus(null), "non_evalue");
});

test("clôture seulement suggérée quand tous les périmètres attendus sont validés", () => {
  assert.equal(canSuggestClosure(["global"], [{ scopeKey: "global", statut: "brouillon" }]), false);
  assert.equal(canSuggestClosure(["global"], [{ scopeKey: "global", statut: "valide" }]), true);
  assert.equal(canSuggestClosure(["a", "b"], [{ scopeKey: "a", statut: "valide" }]), false);
  assert.equal(canSuggestClosure([], []), false);
  assert.equal(scopeKeyOf(null), "global");
  assert.equal(scopeKeyOf("e1"), "e1");
});

test("action corrective préremplie depuis le constat", () => {
  assert.deepEqual(correctiveActionDraft({ libelle: "Pas de plan de reprise", description: "d" }), { title: "Traiter l'écart : Pas de plan de reprise", comments: "d" });
});
