import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventory, type InvUser } from "../src/lib/authzInventory";

const groups = [{ id: "g1", name: "Alpha Santé" }];
const ests = [{ id: "e1", name: "Montreux" }, { id: "e2", name: "Vevey" }];
const u = (over: Partial<InvUser>): InvUser => ({ id: "u", email: "u@x", name: "U", status: "active", lastLoginAt: null, actorId: null, assignments: [], affiliations: [], ...over });

test("compte actif sans affectation : perd l'accès en enforce, piste de régularisation via l'acteur lié", () => {
  const r = buildInventory([u({ id: "a", affiliations: [{ groupId: null, establishmentId: "e1" }] })], groups, ests, []);
  assert.equal(r.rows[0].willLoseAccessOnEnforce, true);
  assert.ok(r.rows[0].flags.includes("AUCUNE_AFFECTATION"));
  assert.deepEqual(r.rows[0].suggestedScopes.map((s) => s.scopeLabel), ["Montreux"]);
  assert.equal(r.readyForEnforce, false);
});

test("prêt pour enforce : un admin plateforme et tous les comptes actifs affectés", () => {
  const r = buildInventory([
    u({ id: "adm", assignments: [{ id: "1", role: "administrateur", scopeType: "plateforme", scopeId: "GLOBAL" }] }),
    u({ id: "d", assignments: [{ id: "2", role: "directeur", scopeType: "groupe", scopeId: "g1" }] }),
    u({ id: "s", status: "suspended" }),
  ], groups, ests, []);
  assert.equal(r.readyForEnforce, true);
  assert.equal(r.summary.administrateursPlateforme, 1);
});

test("incohérences : portée inexistante, rôle sur une portée interdite, doublon, suspendu avec affectations", () => {
  const r = buildInventory([
    u({ id: "adm", assignments: [{ id: "1", role: "administrateur", scopeType: "plateforme", scopeId: "GLOBAL" }] }),
    u({ id: "x", assignments: [{ id: "2", role: "referent_etablissement", scopeType: "etablissement", scopeId: "disparu" }] }),
    u({ id: "y", assignments: [{ id: "3", role: "referent_etablissement", scopeType: "groupe", scopeId: "g1" }] }),
    u({ id: "z", status: "suspended", assignments: [{ id: "4", role: "directeur", scopeType: "groupe", scopeId: "g1" }, { id: "5", role: "directeur", scopeType: "groupe", scopeId: "g1" }] }),
  ], groups, ests, []);
  const f = (id: string) => r.rows.find((x) => x.id === id)!.flags;
  assert.ok(f("x").includes("AFFECTATION_PORTEE_INEXISTANTE"));
  assert.ok(f("y").includes("ROLE_PORTEE_INCOHERENT"));
  assert.ok(f("z").includes("AFFECTATION_EN_DOUBLE") && f("z").includes("SUSPENDU_AVEC_AFFECTATIONS"));
  assert.equal(r.rows.find((x) => x.id === "x")!.willLoseAccessOnEnforce, true); // aucune affectation VALIDE
  assert.equal(r.readyForEnforce, false);
});

test("sans administrateur plateforme : bloquant", () => {
  const r = buildInventory([u({ assignments: [{ id: "1", role: "directeur", scopeType: "groupe", scopeId: "g1" }] })], groups, ests, []);
  assert.ok(r.blockers.some((b) => /administrateur plateforme/i.test(b)));
});
