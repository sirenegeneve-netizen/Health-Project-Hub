import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedEstablishments, applyDerogation, applyStateAction, canDecideDerogation, diffSourceFields, fieldsToApply, pendingChanges, planSelection,
  suggestInitialState, validateSelectionInput,
} from "../src/lib/declinaison";

test("cycle de prise en charge : étapes explicites, retour arrière possible", () => {
  assert.equal(applyStateAction("non_pris_en_charge", null, "prendre_en_charge").value, "pris_en_charge");
  assert.equal(applyStateAction("pris_en_charge", null, "demarrer").value, "en_cours");
  assert.equal(applyStateAction("en_cours", null, "terminer").value, "termine");
  assert.equal(applyStateAction("termine", null, "rouvrir").value, "en_cours");
  assert.equal(applyStateAction("pris_en_charge", null, "annuler_prise_en_charge").value, "non_pris_en_charge");
  assert.equal(applyStateAction(null, null, "prendre_en_charge").value, "pris_en_charge"); // état vide = non pris en charge
});

test("transitions interdites : pas de saut d'étape, pas d'action hors périmètre, pas pendant une demande de dérogation", () => {
  assert.equal(applyStateAction("non_pris_en_charge", null, "terminer").ok, false);
  assert.equal(applyStateAction("non_pris_en_charge", null, "demarrer").ok, false);
  assert.equal(applyStateAction("hors_perimetre", null, "prendre_en_charge").ok, false);
  assert.equal(applyStateAction("non_applicable", null, "prendre_en_charge").ok, false);
  assert.equal(applyStateAction("non_pris_en_charge", "demandee", "prendre_en_charge").ok, false);
});

test("dérogation : demande motivée, décision du groupe, révocation ; jamais après le début de la mise en œuvre", () => {
  assert.equal(applyDerogation({ etat: "non_pris_en_charge", statut: null }, "demander", {}).ok, false); // motif obligatoire
  const asked = applyDerogation({ etat: "non_pris_en_charge", statut: null }, "demander", { motif: "Pas de circuit du médicament dans cet établissement" });
  assert.deepEqual(asked.value, { etat: "non_pris_en_charge", statut: "demandee" });
  assert.equal(applyDerogation({ etat: "non_pris_en_charge", statut: "demandee" }, "demander", { motif: "x" }).ok, false); // déjà en cours
  assert.deepEqual(applyDerogation({ etat: "non_pris_en_charge", statut: "demandee" }, "valider").value, { etat: "non_applicable", statut: "validee" });
  assert.equal(applyDerogation({ etat: "non_pris_en_charge", statut: "demandee" }, "refuser", {}).ok, false); // refus motivé
  assert.deepEqual(applyDerogation({ etat: "pris_en_charge", statut: "demandee" }, "refuser", { note: "Objectif obligatoire" }).value, { etat: "pris_en_charge", statut: "refusee" });
  assert.deepEqual(applyDerogation({ etat: "non_pris_en_charge", statut: "demandee" }, "retirer").value, { etat: "non_pris_en_charge", statut: null });
  assert.deepEqual(applyDerogation({ etat: "non_applicable", statut: "validee" }, "revoquer").value, { etat: "non_pris_en_charge", statut: null });
  assert.equal(applyDerogation({ etat: "en_cours", statut: null }, "demander", { motif: "x" }).ok, false);
  assert.equal(applyDerogation({ etat: "hors_perimetre", statut: null }, "demander", { motif: "x" }).ok, false);
  assert.equal(applyDerogation({ etat: "non_pris_en_charge", statut: null }, "valider").ok, false); // rien à valider
});

test("décision de dérogation : directeur ou administrateur du groupe (ou plateforme), pas le chef de projet ni l'établissement", () => {
  const a = (role: string, scopeType: string, scopeId: string) => [{ role, scopeType, scopeId }];
  assert.equal(canDecideDerogation(a("directeur", "groupe", "g1"), "g1"), true);
  assert.equal(canDecideDerogation(a("administrateur", "groupe", "g1"), "g1"), true);
  assert.equal(canDecideDerogation(a("administrateur", "plateforme", "GLOBAL"), "g1"), true);
  assert.equal(canDecideDerogation(a("chef_de_projet", "groupe", "g1"), "g1"), false);
  assert.equal(canDecideDerogation(a("directeur", "etablissement", "e1"), "g1"), false);
  assert.equal(canDecideDerogation(a("directeur", "groupe", "g2"), "g1"), false);
});

test("état de départ des déclinaisons existantes : « en cours » dès qu'il y a une action, une mesure ou un responsable", () => {
  assert.equal(suggestInitialState({ actions: 0, measures: 0, baselines: 0, hasResponsable: false }), "non_pris_en_charge");
  assert.equal(suggestInitialState({ actions: 1, measures: 0, baselines: 0, hasResponsable: false }), "en_cours");
  assert.equal(suggestInitialState({ actions: 0, measures: 2, baselines: 0, hasResponsable: false }), "en_cours");
  assert.equal(suggestInitialState({ actions: 0, measures: 0, baselines: 1, hasResponsable: false }), "en_cours");
  assert.equal(suggestInitialState({ actions: 0, measures: 0, baselines: 0, hasResponsable: true }), "en_cours");
});

test("diffusion sélective : création, restauration, sortie du périmètre (conservée, jamais supprimée), sans doublon", () => {
  const all = ["e1", "e2", "e3", "e4"];
  const first = planSelection({ mode: "selection", selectedIds: ["e1", "e2"], allEstablishmentIds: all, existingChildren: [] });
  assert.deepEqual(first, { targets: ["e1", "e2"], toCreate: ["e1", "e2"], toRestore: [], toRemove: [] });
  // e2 est retiré, e3 ajouté
  const second = planSelection({ mode: "selection", selectedIds: ["e1", "e3"], allEstablishmentIds: all, existingChildren: [{ establishmentId: "e1", miseEnOeuvre: "en_cours" }, { establishmentId: "e2", miseEnOeuvre: "pris_en_charge" }] });
  assert.deepEqual(second, { targets: ["e1", "e3"], toCreate: ["e3"], toRestore: [], toRemove: ["e2"] });
  // e2 revient : sa déclinaison hors périmètre est restaurée (pas de doublon)
  const third = planSelection({ mode: "selection", selectedIds: ["e1", "e2", "e3"], allEstablishmentIds: all, existingChildren: [{ establishmentId: "e1", miseEnOeuvre: "en_cours" }, { establishmentId: "e2", miseEnOeuvre: "hors_perimetre" }, { establishmentId: "e3", miseEnOeuvre: "non_pris_en_charge" }] });
  assert.deepEqual(third, { targets: ["e1", "e2", "e3"], toCreate: [], toRestore: ["e2"], toRemove: [] });
  // idempotent : rejouer la même sélection ne change rien
  const again = planSelection({ mode: "selection", selectedIds: ["e1", "e3"], allEstablishmentIds: all, existingChildren: [{ establishmentId: "e1", miseEnOeuvre: "en_cours" }, { establishmentId: "e3", miseEnOeuvre: "non_pris_en_charge" }, { establishmentId: "e2", miseEnOeuvre: "hors_perimetre" }] });
  assert.deepEqual([again.toCreate, again.toRestore, again.toRemove], [[], [], []]);
  // mode « tous » : tous les établissements, y compris un établissement nouvellement rattaché
  const tous = planSelection({ mode: "tous", selectedIds: [], allEstablishmentIds: all, existingChildren: [{ establishmentId: "e1", miseEnOeuvre: "en_cours" }] });
  assert.deepEqual(tous.toCreate, ["e2", "e3", "e4"]);
  // un identifiant hors du groupe est ignoré par le plan et refusé par la validation
  assert.deepEqual(planSelection({ mode: "selection", selectedIds: ["intrus", "e1"], allEstablishmentIds: all, existingChildren: [] }).targets, ["e1"]);
  assert.match(validateSelectionInput("selection", ["intrus"], all) || "", /hors du groupe/);
  assert.match(validateSelectionInput("selection", [], all) || "", /au moins un/);
  assert.equal(validateSelectionInput("tous", [], all), null);
  assert.match(validateSelectionInput("autre", [], all) || "", /invalide/);
});

test("changements du groupe : suivis champ par champ, aucun changement fantôme, intitulé/description signalés comme déjà propagés", () => {
  const before = { libelle: "Sécurité médicamenteuse", description: "A", resultatAttendu: "R1", axe: null, echeance: new Date("2027-06-30"), perimetreOrg: ["groupe"], populations: [], perimetre: "" };
  const same = diffSourceFields(before, { ...before, echeance: new Date("2027-06-30"), perimetreOrg: ["groupe"] });
  assert.deepEqual(same, {});
  const d = diffSourceFields(before, { ...before, libelle: "Améliorer la sécurité médicamenteuse", resultatAttendu: "R2", echeance: new Date("2027-12-31"), populations: ["personnel_soignant"], axe: "Qualité" });
  assert.deepEqual(Object.keys(d).sort(), ["axe", "echeance", "libelle", "populations", "resultatAttendu"]);
  assert.equal(d.libelle.auto, true);
  assert.equal(d.resultatAttendu.auto, false);
  assert.deepEqual(d.echeance, { from: "2027-06-30", to: "2027-12-31", auto: false });
  // seuls les champs non propagés automatiquement sont recopiés à l'acceptation ; la cible locale n'est jamais suivie
  assert.deepEqual(fieldsToApply(d).sort(), ["axe", "echeance", "populations", "resultatAttendu"]);
  assert.equal(diffSourceFields(before, { cible: "100 %" } as any).cible, undefined);
  // un champ absent du nouvel état n'est pas considéré comme effacé
  assert.deepEqual(diffSourceFields(before, { description: "A" }), {});
});

test("signalements à examiner : postérieurs à la déclinaison et sans décision", () => {
  const t = (d: string) => new Date(d);
  const changes = [{ id: "c1", createdAt: t("2026-01-10") }, { id: "c2", createdAt: t("2026-03-10") }, { id: "c3", createdAt: t("2026-04-10") }];
  const child = t("2026-02-01"); // c1 est antérieur à la déclinaison : non concerné
  assert.deepEqual(pendingChanges(changes, [], child).map((c) => c.id), ["c2", "c3"]);
  assert.deepEqual(pendingChanges(changes, ["c2"], child).map((c) => c.id), ["c3"]);
  assert.deepEqual(pendingChanges(changes, ["c2", "c3"], child), []);
});

test("P1 — destinataires d'un cycle : « tous » inclut les rattachés plus tard, « selection » se limite à la liste valide", () => {
  assert.deepEqual(allowedEstablishments("tous", [], ["e1", "e2"]), ["e1", "e2"]);
  assert.deepEqual(allowedEstablishments("aucune", [], ["e1", "e2"]), ["e1", "e2"]); // anciennes diffusions
  assert.deepEqual(allowedEstablishments("selection", ["e2", "e9", "e2"], ["e1", "e2"]), ["e2"]);
  assert.deepEqual(allowedEstablishments("selection", [], ["e1", "e2"]), []);
});
