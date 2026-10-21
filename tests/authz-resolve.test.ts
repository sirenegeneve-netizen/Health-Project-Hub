import { test } from "node:test";
import assert from "node:assert/strict";
import { recordScope, bodyScopes, authorizeScopes, cycleScope, type Access } from "../src/lib/accessResolve";
import type { Assignment } from "../src/lib/authzCore";

// Double de base en mémoire : vérifie la RÉSOLUTION des portées (rattachement groupe / établissement / projet) et la décision
// qui en découle. Ne remplace pas un test sur une vraie base (voir scripts/authz-smoke.mjs en préproduction).
function fakeDb(t: Record<string, any[]>) {
  const matches = (row: any, where: any) => Object.entries(where || {}).every(([k, v]) => (v && typeof v === "object" && "in" in (v as any) ? (v as any).in.includes(row[k]) : row[k] === v));
  const delegate = (name: string) => ({
    findUnique: async ({ where, select }: any) => {
      const r = (t[name] || []).find((x) => matches(x, where));
      if (!r) return null;
      if (name === "initiative") return { ...r, establishments: (t.initiativeEstablishment || []).filter((e) => e.initiativeId === r.id) };
      if (name === "strategicGoalCycle") return { ...r, strategicGoal: (t.strategicGoal || []).find((g) => g.id === r.strategicGoalId) };
      return r;
    },
    findMany: async ({ where }: any) => {
      let rows = (t[name] || []).filter((x) => matches(x, where));
      if (name === "strategicGoalCycle") rows = rows.map((r) => ({ ...r, strategicGoal: (t.strategicGoal || []).find((g) => g.id === r.strategicGoalId) }));
      return rows;
    },
  });
  return new Proxy({}, { get: (_o, name: string) => delegate(name) }) as any;
}

const db = fakeDb({
  group: [{ id: "G1" }],
  establishment: [{ id: "E1", groupId: "G1" }, { id: "E2", groupId: "G1" }],
  initiative: [{ id: "P1", groupId: "G1" }, { id: "P2", groupId: "G1" }],
  initiativeEstablishment: [{ initiativeId: "P1", establishmentId: "E1" }, { initiativeId: "P2", establishmentId: "E2" }],
  action: [
    { id: "A-E1", ownerType: "etablissement", ownerId: "E1" },
    { id: "A-E2", ownerType: "etablissement", ownerId: "E2" },
    { id: "A-G", ownerType: "groupe", ownerId: "G1" },
  ],
  risk: [{ id: "R-P2", ownerType: "initiative", ownerId: "P2", initiativeId: "P2" }, { id: "R-OLD", ownerType: null, ownerId: null, initiativeId: "P1" }],
  anomaly: [{ id: "AN-P2", initiativeId: "P2" }],
  strategicGoal: [{ id: "GOAL-G", ownerType: "groupe", ownerId: "G1" }, { id: "GOAL-E2", ownerType: "etablissement", ownerId: "E2" }],
  strategicGoalCycle: [{ id: "CY-G", strategicGoalId: "GOAL-G" }, { id: "CY-E2", strategicGoalId: "GOAL-E2", parentCycleId: "CY-G" }],
  goalIndicator: [{ id: "IND-E2", strategicGoalCycleId: "CY-E2" }],
  goalIndicatorMeasure: [{ id: "M-E2", goalIndicatorId: "IND-E2" }],
});

const access = (assignments: Assignment[], mode: "audit" | "enforce" = "enforce"): Access => ({ user: { id: "u", email: "u@x", name: "U", actorId: null }, assignments, mode, db });
const as = (role: any, scopeType: any, scopeId: string): Assignment => ({ role, scopeType, scopeId });
const can = async (a: Access, action: any, model: any, id: string) => (await authorizeScopes(a, action, [await recordScope(db, model, id)], `${model}:${id}`)).allowed;

test("accès croisés par identifiant : l'utilisateur de E1 ne lit ni ne modifie rien de E2", async () => {
  const u1 = access([as("chef_de_projet", "etablissement", "E1")]);
  assert.equal(await can(u1, "voir", "action", "A-E1"), true);
  assert.equal(await can(u1, "modifier", "action", "A-E1"), true);
  for (const [m, id] of [["action", "A-E2"], ["risk", "R-P2"], ["anomaly", "AN-P2"], ["strategicGoalCycle", "CY-E2"], ["goalIndicator", "IND-E2"], ["goalIndicatorMeasure", "M-E2"], ["initiative", "P2"]] as const) {
    assert.equal(await can(u1, "voir", m, id), false, `lecture ${m} ${id}`);
    assert.equal(await can(u1, "modifier", m, id), false, `modification ${m} ${id}`);
  }
});

test("la ressource est rattachée par la base, pas par le navigateur : indicateur → cycle → objectif → établissement", async () => {
  const u2 = access([as("directeur", "etablissement", "E2")]);
  assert.equal(await can(u2, "modifier", "goalIndicatorMeasure", "M-E2"), true);
  assert.equal(await can(access([as("directeur", "etablissement", "E1")]), "voir", "goalIndicatorMeasure", "M-E2"), false);
});

test("directeur de groupe : consulte E1 et E2, ne modifie pas leurs données locales, modifie celles du groupe", async () => {
  const d = access([as("directeur", "groupe", "G1")]);
  assert.equal(await can(d, "voir", "action", "A-E2"), true);
  assert.equal(await can(d, "modifier", "action", "A-E2"), false);
  assert.equal(await can(d, "modifier", "goalIndicator", "IND-E2"), false);
  assert.equal(await can(d, "modifier", "action", "A-G"), true);
});

test("objectif de groupe : lisible seulement par les établissements qui en portent une déclinaison, jamais modifiable", async () => {
  const s = await cycleScope(db, "CY-G");
  assert.deepEqual(s?.sharedReadEstablishmentIds, ["E2"]);
  assert.equal(await can(access([as("referent_etablissement", "etablissement", "E2")]), "voir", "strategicGoalCycle", "CY-G"), true);
  assert.equal(await can(access([as("referent_etablissement", "etablissement", "E2")]), "modifier", "strategicGoalCycle", "CY-G"), false);
  assert.equal(await can(access([as("referent_etablissement", "etablissement", "E1")]), "voir", "strategicGoalCycle", "CY-G"), false);
});

test("anciennes lignes sans propriétaire : rattachées par leur projet", async () => {
  assert.equal(await can(access([as("chef_de_projet", "etablissement", "E1")]), "voir", "risk", "R-OLD"), true);
  assert.equal(await can(access([as("chef_de_projet", "etablissement", "E2")]), "voir", "risk", "R-OLD"), false);
});

test("création falsifiée : toutes les références du corps doivent être autorisées", async () => {
  const u1 = access([as("chef_de_projet", "etablissement", "E1")]);
  // propriétaire E1 (autorisé) mais cycle de E2 (interdit) → refusé
  const forged = await bodyScopes(db, { ownerType: "etablissement", ownerId: "E1", strategicGoalCycleId: "CY-E2" });
  assert.equal((await authorizeScopes(u1, "creer", forged, "action:création")).allowed, false);
  const ok = await bodyScopes(db, { ownerType: "etablissement", ownerId: "E1" });
  assert.equal((await authorizeScopes(u1, "creer", ok, "action:création")).allowed, true);
  // identifiant inexistant → référence introuvable → refusé
  const ghost = await bodyScopes(db, { initiativeId: "NOPE" });
  assert.equal((await authorizeScopes(u1, "creer", ghost, "x")).allowed, false);
});

test("sans affectation : refusé en mode enforce ; en mode audit, non bloquant mais journalisé", async () => {
  const none = access([], "enforce");
  assert.equal(await can(none, "voir", "action", "A-E1"), false);
  const warn = console.warn; const logs: string[] = [];
  console.warn = (m: any) => logs.push(String(m));
  try {
    assert.equal(await can(access([], "audit"), "voir", "action", "A-E1"), true);
  } finally { console.warn = warn; }
  assert.ok(logs.some((l) => l.includes("audit-would-deny")));
});

test("établissement cité à côté d'une cible : simple lien (voir) ; cité seul : cible d'écriture", async () => {
  const groupChef = access([as("chef_de_projet", "groupe", "G1")]);
  // rattacher un projet à un établissement : écriture sur le projet, simple lecture sur l'établissement
  const link = await bodyScopes(db, { initiativeId: "P2", establishmentId: "E2" });
  assert.equal((await authorizeScopes(groupChef, "creer", link, "initiative-establishment")).allowed, true);
  // un utilisateur de E1 ne peut pas rattacher à son projet un établissement qu'il ne voit pas
  const u1 = access([as("chef_de_projet", "etablissement", "E1")]);
  const stolen = await bodyScopes(db, { initiativeId: "P1", establishmentId: "E2" });
  assert.equal((await authorizeScopes(u1, "creer", stolen, "initiative-establishment")).allowed, false);
  // établissement seul : c'est la cible de l'écriture
  const alone = await bodyScopes(db, { establishmentId: "E2" });
  assert.equal((await authorizeScopes(groupChef, "creer", alone, "x")).allowed, false);
});
