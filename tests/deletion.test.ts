// Tests d'intégration de la suppression des données métier.
//
// Ils s'exécutent contre une VRAIE base PostgreSQL de test (jamais la base de
// production) : définir TEST_DATABASE_URL vers une base vide dont le schéma a
// été poussé (`DATABASE_URL=$TEST_DATABASE_URL npx prisma db push`).
//
//   TEST_DATABASE_URL=postgresql://... npm test
//
// Chaque test crée ses propres données (préfixe unique) et ne touche à rien d'autre.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  deleteEstablishmentData,
  deleteGroupData,
  deleteInitiativeData,
  deleteSimpleData,
} from "../src/lib/deletionCore";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL est requis (base de test dédiée, jamais la production).");
if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL ne doit pas être identique à DATABASE_URL.");

const db = new PrismaClient({ datasourceUrl: url });
const RUN = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let seq = 0;
const n = (label: string) => `${RUN}-${label}-${++seq}`;

before(async () => {
  await db.$connect();
});
after(async () => {
  await db.$disconnect();
});

// --- fabriques -------------------------------------------------------------------------

async function makeGroup() {
  return db.group.create({ data: { name: n("groupe") } });
}
async function makeEstablishment(groupId: string) {
  return db.establishment.create({ data: { name: n("etab"), groupId } });
}
async function makeInitiative(groupId: string, establishmentIds: string[] = []) {
  const i = await db.initiative.create({ data: { reference: n("ref"), name: n("init"), type: "deploiement", groupId } });
  for (const establishmentId of establishmentIds) await db.initiativeEstablishment.create({ data: { initiativeId: i.id, establishmentId } });
  return i;
}
async function makeUser(label = "user") {
  return db.user.create({ data: { email: `${n(label)}@test.local`, name: n(label), passwordHash: "x" } });
}
async function exists(model: "group" | "establishment" | "initiative" | "action" | "risk" | "meeting" | "user" | "actor" | "decision" | "kpi", id: string) {
  return !!(await (db as any)[model].findUnique({ where: { id } }));
}

// 1. Suppression d'une initiative ---------------------------------------------------------------------
test("supprime une initiative et ses données rattachées, pas le groupe ni l'établissement", async () => {
  const g = await makeGroup();
  const e = await makeEstablishment(g.id);
  const i = await makeInitiative(g.id, [e.id]);
  const meeting = await db.meeting.create({ data: { initiativeId: i.id, type: "kickoff", title: n("m"), date: new Date() } });
  const action = await db.action.create({ data: { initiativeId: i.id, title: n("a") } });
  const risk = await db.risk.create({ data: { initiativeId: i.id, description: n("r") } });
  const decision = await db.decision.create({ data: { initiativeId: i.id, subject: n("d") } });
  const doc = await db.documentRef.create({ data: { initiativeId: i.id, title: n("doc") } });
  const kpi = await db.kpi.create({ data: { initiativeId: i.id, name: n("k"), value: 1 } });

  const summary = await deleteInitiativeData(db, i.id);

  assert.equal(await exists("initiative", i.id), false);
  for (const [m, id] of [["meeting", meeting.id], ["action", action.id], ["risk", risk.id], ["decision", decision.id], ["kpi", kpi.id]] as const) {
    assert.equal(await exists(m, id), false, `${m} aurait dû être supprimé`);
  }
  assert.equal(await db.documentRef.count({ where: { id: doc.id } }), 0);
  assert.equal(await exists("group", g.id), true);
  assert.equal(await exists("establishment", e.id), true);
  assert.equal(summary.deleted.initiatives, 1);
});

// 2. Suppression d'un établissement -----------------------------------------------------------------
test("supprime un établissement et ses objets propres, conserve l'initiative (lien retiré)", async () => {
  const g = await makeGroup();
  const e = await makeEstablishment(g.id);
  const other = await makeEstablishment(g.id);
  const i = await makeInitiative(g.id, [e.id, other.id]);
  const ownedRisk = await db.risk.create({ data: { ownerType: "etablissement", ownerId: e.id, description: n("r") } });
  const ownedAction = await db.action.create({ data: { ownerType: "etablissement", ownerId: e.id, title: n("a") } });
  const product = await db.installedProduct.create({ data: { establishmentId: e.id, name: n("p") } as any });

  await deleteEstablishmentData(db, e.id);

  assert.equal(await exists("establishment", e.id), false);
  assert.equal(await exists("risk", ownedRisk.id), false);
  assert.equal(await exists("action", ownedAction.id), false);
  assert.equal(await db.installedProduct.count({ where: { id: product.id } }), 0);
  assert.equal(await exists("initiative", i.id), true, "l'initiative appartient au groupe");
  assert.equal(await db.initiativeEstablishment.count({ where: { initiativeId: i.id, establishmentId: e.id } }), 0);
  assert.equal(await db.initiativeEstablishment.count({ where: { initiativeId: i.id, establishmentId: other.id } }), 1);
  assert.equal(await exists("establishment", other.id), true);
});

// 3. Suppression d'un groupe ----------------------------------------------------------------------------
test("supprime un groupe, ses établissements, ses initiatives et leurs données", async () => {
  const g = await makeGroup();
  const e = await makeEstablishment(g.id);
  const i = await makeInitiative(g.id, [e.id]);
  const gRisk = await db.risk.create({ data: { ownerType: "groupe", ownerId: g.id, description: n("r") } });
  const iAction = await db.action.create({ data: { initiativeId: i.id, title: n("a") } });
  const outsideGroup = await makeGroup();
  const outsideInit = await makeInitiative(outsideGroup.id);

  await deleteGroupData(db, g.id);

  assert.equal(await exists("group", g.id), false);
  assert.equal(await exists("establishment", e.id), false);
  assert.equal(await exists("initiative", i.id), false);
  assert.equal(await exists("risk", gRisk.id), false);
  assert.equal(await exists("action", iAction.id), false);
  assert.equal(await exists("group", outsideGroup.id), true, "un autre groupe n'est pas touché");
  assert.equal(await exists("initiative", outsideInit.id), true);
});

// 4. Suppression d'une action ------------------------------------------------------------------------------
test("supprime une action sans toucher au risque ni à l'initiative", async () => {
  const g = await makeGroup();
  const i = await makeInitiative(g.id);
  const risk = await db.risk.create({ data: { initiativeId: i.id, description: n("r") } });
  const action = await db.action.create({ data: { initiativeId: i.id, riskId: risk.id, title: n("a") } });
  const doc = await db.documentRef.create({ data: { initiativeId: i.id, title: n("d"), linkedType: "action", linkedId: action.id } });

  await deleteSimpleData(db, "action", action.id);

  assert.equal(await exists("action", action.id), false);
  assert.equal(await exists("risk", risk.id), true);
  assert.equal(await exists("initiative", i.id), true);
  const after = await db.documentRef.findUniqueOrThrow({ where: { id: doc.id } });
  assert.equal(after.linkedId, null, "le document est conservé, son lien devenu invalide est retiré");
});

// 5. Suppression d'un risque -------------------------------------------------------------------------------------
test("supprime un risque ; l'action liée est conservée et détachée", async () => {
  const g = await makeGroup();
  const i = await makeInitiative(g.id);
  const risk = await db.risk.create({ data: { initiativeId: i.id, description: n("r") } });
  const action = await db.action.create({ data: { initiativeId: i.id, riskId: risk.id, title: n("a") } });

  await deleteSimpleData(db, "risk", risk.id);

  assert.equal(await exists("risk", risk.id), false);
  const a = await db.action.findUniqueOrThrow({ where: { id: action.id } });
  assert.equal(a.riskId, null);
});

// 6. Suppression d'une réunion -----------------------------------------------------------------------------------
test("supprime une réunion ; actions et décisions liées sont conservées et détachées", async () => {
  const g = await makeGroup();
  const i = await makeInitiative(g.id);
  const meeting = await db.meeting.create({ data: { initiativeId: i.id, type: "copil", title: n("m"), date: new Date() } });
  const action = await db.action.create({ data: { initiativeId: i.id, meetingId: meeting.id, title: n("a") } });
  const decision = await db.decision.create({ data: { initiativeId: i.id, meetingId: meeting.id, subject: n("d") } });

  await deleteSimpleData(db, "meeting", meeting.id);

  assert.equal(await exists("meeting", meeting.id), false);
  assert.equal((await db.action.findUniqueOrThrow({ where: { id: action.id } })).meetingId, null);
  assert.equal((await db.decision.findUniqueOrThrow({ where: { id: decision.id } })).meetingId, null);
});

// 7. Les utilisateurs survivent ---------------------------------------------------------------------------------
test("un utilisateur affecté et lié à un acteur reste présent après suppression de son groupe/établissement", async () => {
  const g = await makeGroup();
  const e = await makeEstablishment(g.id);
  const i = await makeInitiative(g.id, [e.id]);
  const actor = await db.actor.create({ data: { name: n("acteur"), initiativeId: i.id } });
  const user = await makeUser();
  await db.user.update({ where: { id: user.id }, data: { actorId: actor.id } });
  await db.session.create({ data: { token: n("tok"), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
  await db.userAssignment.create({ data: { userId: user.id, role: "chef_de_projet", scopeType: "groupe", scopeId: g.id } });
  await db.userAssignment.create({ data: { userId: user.id, role: "chef_de_projet", scopeType: "etablissement", scopeId: e.id } });

  await deleteGroupData(db, g.id);

  const u = await db.user.findUnique({ where: { id: user.id }, include: { sessions: true, assignments: true } });
  assert.ok(u, "le compte utilisateur doit exister");
  assert.equal(u!.passwordHash, "x", "l'authentification est intacte");
  assert.equal(u!.sessions.length, 1, "la session est conservée");
  assert.equal(u!.actorId, actor.id, "l'acteur lié au compte est conservé (détaché de l'initiative)");
  assert.equal(await exists("actor", actor.id), true);
  assert.equal((await db.actor.findUniqueOrThrow({ where: { id: actor.id } })).initiativeId, null);
  assert.ok(u!.assignments.length >= 1, "au moins une affectation reste, pour ne pas ouvrir le mode transitoire (accès complet)");
});

test("supprimer une initiative conserve un acteur réutilisé par une autre initiative", async () => {
  const g = await makeGroup();
  const a = await makeInitiative(g.id);
  const b = await makeInitiative(g.id);
  const shared = await db.actor.create({ data: { name: n("partage"), initiativeId: a.id } });
  const own = await db.actor.create({ data: { name: n("propre"), initiativeId: a.id } });
  await db.raciEntry.create({ data: { initiativeId: b.id, actorId: shared.id, activite: n("act"), role: "R" } });

  await deleteInitiativeData(db, a.id);

  assert.equal(await exists("actor", shared.id), true);
  assert.equal(await exists("actor", own.id), false);
  assert.equal(await db.raciEntry.count({ where: { initiativeId: b.id, actorId: shared.id } }), 1);
});

// 8. Atomicité ---------------------------------------------------------------------------------------------------
test("une suppression qui échoue en cours de route n'en laisse rien de supprimé", async () => {
  const g = await makeGroup();
  const e = await makeEstablishment(g.id);
  const i = await makeInitiative(g.id, [e.id]);
  const risk = await db.risk.create({ data: { initiativeId: i.id, description: n("r") } });
  const gAction = await db.action.create({ data: { ownerType: "groupe", ownerId: g.id, title: n("a") } });

  await assert.rejects(
    deleteGroupData(db, g.id, {
      afterStep: (step) => {
        // panne simulée après la suppression des initiatives et des établissements
        if (step === "groupe:objets") throw new Error("panne simulée");
      },
    }),
    /panne simulée/
  );

  assert.equal(await exists("group", g.id), true);
  assert.equal(await exists("establishment", e.id), true);
  assert.equal(await exists("initiative", i.id), true);
  assert.equal(await exists("risk", risk.id), true);
  assert.equal(await exists("action", gAction.id), true);
  assert.equal(await db.initiativeEstablishment.count({ where: { initiativeId: i.id, establishmentId: e.id } }), 1);
});
