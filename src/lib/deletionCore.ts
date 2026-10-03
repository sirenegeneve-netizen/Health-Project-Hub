import { Prisma, PrismaClient } from "@prisma/client";

// Noyau de suppression des données métier. Aucune dépendance à Next/HTTP :
// il prend un client Prisma, ce qui le rend testable contre une base réelle.
//
// RÈGLES FONDAMENTALES (jamais violées ici) :
//  - aucune ligne `User`, `Session`, `InviteToken` n'est supprimée ;
//  - les `UserAssignment` ne sont retirées que si l'utilisateur en garde au
//    moins une autre (sinon il retomberait en "mode transitoire" = accès
//    complet, cf. authz.ts) — dans ce cas elles restent, inertes ;
//  - les référentiels (WorkflowStage, StageCriterionTemplate, Methodology*,
//    ProjectType, StageDefinition, ProjectTemplate et ses étapes) ne sont
//    jamais touchés — seule la copie figée `InitiativeStage` d'une initiative
//    supprimée part avec elle (cascade) ;
//  - un `Actor` n'est supprimé que s'il n'est ni lié à un compte, ni rattaché
//    à un groupe/établissement, ni référencé hors de l'initiative supprimée.

export type Tx = Prisma.TransactionClient;
export type DeletionHooks = {
  // Appelé après chaque étape (utilisé par les tests pour simuler une panne).
  afterStep?: (step: string) => void | Promise<void>;
  // Appelé dans la transaction, juste avant le commit (ex. journal d'audit
  // atomique avec la suppression).
  inTx?: (tx: Tx, summary: DeletionSummary) => void | Promise<void>;
};

export type DeletionSummary = {
  deleted: Record<string, number>;
  blobUrls: string[];
};

const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

function add(summary: DeletionSummary, key: string, n: number) {
  if (n > 0) summary.deleted[key] = (summary.deleted[key] ?? 0) + n;
}

async function step(hooks: DeletionHooks | undefined, name: string) {
  if (hooks?.afterStep) await hooks.afterStep(name);
}

// --- Affectations utilisateurs (jamais les comptes) ---------------------------------

async function removeAssignments(tx: Tx, scopeType: string, scopeIds: string[], summary: DeletionSummary) {
  if (scopeIds.length === 0) return;
  const rows = await tx.userAssignment.findMany({ where: { scopeType, scopeId: { in: scopeIds } } });
  if (rows.length === 0) return;
  const batchIds = rows.map((r) => r.id);
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.id]);

  for (const [userId, ids] of byUser) {
    const others = await tx.userAssignment.count({ where: { userId, id: { notIn: batchIds } } });
    if (others > 0) {
      const res = await tx.userAssignment.deleteMany({ where: { id: { in: ids } } });
      add(summary, "affectations_retirees", res.count);
    }
    // sinon : on conserve l'affectation (inerte, elle ne couvre plus rien) pour
    // ne pas donner un accès complet à un utilisateur qui n'aurait plus aucune
    // affectation.
  }
}

// --- Acteurs -----------------------------------------------------------------------

async function actorReferencedOutside(tx: Tx, actorId: string, initiativeIds: string[]): Promise<boolean> {
  const outsideNullable = { OR: [{ initiativeId: null }, { initiativeId: { notIn: initiativeIds } }] };
  const outside = { initiativeId: { notIn: initiativeIds } };

  const checks: Array<() => Promise<number>> = [
    () => tx.raciEntry.count({ where: { actorId, ...outside } }),
    () => tx.actorAllocation.count({ where: { actorId, ...outside } }),
    () => tx.meetingParticipant.count({ where: { actorId, meeting: outside } }),
    () => tx.action.count({ where: { responsableActorId: actorId, ...outsideNullable } }),
    () => tx.risk.count({ where: { proprietaireActorId: actorId, ...outsideNullable } }),
    () => tx.decision.count({ where: { decideurActorId: actorId, ...outsideNullable } }),
    () => tx.interface.count({ where: { responsableActorId: actorId, ...outside } }),
    () => tx.deliverable.count({ where: { responsableActorId: actorId, ...outside } }),
    () => tx.trainingSession.count({ where: { formateurActorId: actorId, ...outside } }),
    () => tx.trainingRecord.count({ where: { referentActorId: actorId, ...outside } }),
    () => tx.incident.count({ where: { declarantActorId: actorId, ...outside } }),
    () => tx.initiative.count({ where: { id: { notIn: initiativeIds }, OR: [{ chefDeProjetId: actorId }, { sponsorId: actorId }] } }),
  ];
  for (const check of checks) {
    if ((await check()) > 0) return true;
  }
  return false;
}

// `Actor.initiativeId` est en onDelete: Cascade : supprimer l'initiative
// effacerait aussi ses acteurs, même ceux réutilisés ailleurs. On détache donc
// (initiativeId = null) tout acteur qui doit survivre, et on ne supprime que les
// acteurs réellement propres à l'initiative.
async function handleInitiativeActors(tx: Tx, initiativeIds: string[], summary: DeletionSummary) {
  const actors = await tx.actor.findMany({
    where: { initiativeId: { in: initiativeIds } },
    select: { id: true, account: { select: { id: true } }, _count: { select: { affiliations: true } } },
  });
  const keep: string[] = [];
  const drop: string[] = [];
  for (const a of actors) {
    const shared = !!a.account || a._count.affiliations > 0 || (await actorReferencedOutside(tx, a.id, initiativeIds));
    (shared ? keep : drop).push(a.id);
  }
  if (keep.length) await tx.actor.updateMany({ where: { id: { in: keep } }, data: { initiativeId: null } });
  if (drop.length) {
    const res = await tx.actor.deleteMany({ where: { id: { in: drop } } });
    add(summary, "acteurs", res.count);
  }
  if (keep.length) add(summary, "acteurs_conserves_detaches", keep.length);
}

// --- Objets possédés via ownerType/ownerId (sans clé étrangère) ---------------------

async function deleteDocuments(tx: Tx, where: Prisma.DocumentRefWhereInput, summary: DeletionSummary) {
  const docs = await tx.documentRef.findMany({ where, select: { id: true, fileUrl: true } });
  if (docs.length === 0) return;
  for (const d of docs) if (d.fileUrl) summary.blobUrls.push(d.fileUrl);
  const res = await tx.documentRef.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  add(summary, "documents", res.count);
}

async function deleteOwned(tx: Tx, ownerType: "groupe" | "etablissement" | "initiative", ownerIds: string[], summary: DeletionSummary) {
  if (ownerIds.length === 0) return;
  const owner = { ownerType, ownerId: { in: ownerIds } };
  await deleteDocuments(tx, owner, summary);
  add(summary, "actions", (await tx.action.deleteMany({ where: owner })).count);
  add(summary, "risques", (await tx.risk.deleteMany({ where: owner })).count);
  add(summary, "decisions", (await tx.decision.deleteMany({ where: owner })).count);
  if (ownerType !== "initiative") {
    add(summary, "constats_audit", (await tx.auditFinding.deleteMany({ where: owner })).count);
    add(summary, "exigences_qualite", (await tx.qualityRequirement.deleteMany({ where: owner })).count);
    add(summary, "plans_strategiques", (await tx.strategicPlan.deleteMany({ where: owner })).count);
    add(summary, "objectifs_strategiques", (await tx.strategicGoal.deleteMany({ where: owner })).count);
  }
}

// --- Suppression d'initiatives --------------------------------------------------------

async function deleteInitiativesTx(tx: Tx, initiativeIds: string[], summary: DeletionSummary, hooks?: DeletionHooks) {
  if (initiativeIds.length === 0) return;

  // Compteurs (les lignes enfants partent par cascade SQL, on les compte avant).
  const where = { initiativeId: { in: initiativeIds } };
  add(summary, "reunions", await tx.meeting.count({ where }));
  add(summary, "indicateurs", await tx.kpi.count({ where }));
  add(summary, "livrables", await tx.deliverable.count({ where }));
  add(summary, "incidents", await tx.incident.count({ where }));

  // Documents (avec collecte des fichiers Blob), puis objets à portée initiative
  // — y compris ceux dont seul ownerId pointe vers l'initiative.
  await deleteDocuments(tx, { OR: [{ initiativeId: { in: initiativeIds } }, { ownerType: "initiative", ownerId: { in: initiativeIds } }] }, summary);
  add(summary, "actions", (await tx.action.deleteMany({ where: { OR: [where, { ownerType: "initiative", ownerId: { in: initiativeIds } }] } })).count);
  add(summary, "risques", (await tx.risk.deleteMany({ where: { OR: [where, { ownerType: "initiative", ownerId: { in: initiativeIds } }] } })).count);
  add(summary, "decisions", (await tx.decision.deleteMany({ where: { OR: [where, { ownerType: "initiative", ownerId: { in: initiativeIds } }] } })).count);
  await step(hooks, "initiative:objets");

  await handleInitiativeActors(tx, initiativeIds, summary);
  await step(hooks, "initiative:acteurs");

  await removeAssignments(tx, "initiative", initiativeIds, summary);

  // Le reste (RACI, jalons, KPI, livrables, interfaces, incidents, relations,
  // contributions aux objectifs, couvertures d'exigences, allocations, timeline…)
  // est supprimé par les onDelete: Cascade déjà définis dans le schéma.
  const res = await tx.initiative.deleteMany({ where: { id: { in: initiativeIds } } });
  add(summary, "initiatives", res.count);
  await step(hooks, "initiative:racine");
}

// --- Suppression d'établissements ------------------------------------------------------

async function deleteEstablishmentsTx(tx: Tx, establishmentIds: string[], summary: DeletionSummary, hooks?: DeletionHooks) {
  if (establishmentIds.length === 0) return;

  await deleteOwned(tx, "etablissement", establishmentIds, summary);
  await step(hooks, "etablissement:objets");

  // Les initiatives appartiennent au GROUPE (elles peuvent couvrir plusieurs
  // établissements) : on retire seulement le lien. InitiativeEstablishment →
  // Establishment n'a pas de cascade (Restrict par défaut), donc ce retrait est
  // obligatoire avant la suppression.
  add(summary, "liens_initiative_etablissement", (await tx.initiativeEstablishment.deleteMany({ where: { establishmentId: { in: establishmentIds } } })).count);
  await removeAssignments(tx, "etablissement", establishmentIds, summary);

  // Produits installés, interfaces d'écosystème, affiliations d'acteurs :
  // cascade SQL. Incidents, formations, risques/actions d'initiative qui
  // citent l'établissement : SetNull (conservés).
  add(summary, "produits_installes", await tx.installedProduct.count({ where: { establishmentId: { in: establishmentIds } } }));
  const res = await tx.establishment.deleteMany({ where: { id: { in: establishmentIds } } });
  add(summary, "etablissements", res.count);
  await step(hooks, "etablissement:racine");
}

// --- API publique du noyau -----------------------------------------------------------------

export async function deleteInitiativeData(db: PrismaClient, initiativeId: string, hooks?: DeletionHooks): Promise<DeletionSummary> {
  const summary: DeletionSummary = { deleted: {}, blobUrls: [] };
  await db.$transaction(async (tx) => {
    await deleteInitiativesTx(tx, [initiativeId], summary, hooks);
    await hooks?.inTx?.(tx, summary);
  }, TX_OPTIONS);
  return summary;
}

export async function deleteEstablishmentData(db: PrismaClient, establishmentId: string, hooks?: DeletionHooks): Promise<DeletionSummary> {
  const summary: DeletionSummary = { deleted: {}, blobUrls: [] };
  await db.$transaction(async (tx) => {
    await deleteEstablishmentsTx(tx, [establishmentId], summary, hooks);
    await hooks?.inTx?.(tx, summary);
  }, TX_OPTIONS);
  return summary;
}

export async function deleteGroupData(db: PrismaClient, groupId: string, hooks?: DeletionHooks): Promise<DeletionSummary> {
  const summary: DeletionSummary = { deleted: {}, blobUrls: [] };
  await db.$transaction(async (tx) => {
    const initiativeIds = (await tx.initiative.findMany({ where: { groupId }, select: { id: true } })).map((i) => i.id);
    const establishmentIds = (await tx.establishment.findMany({ where: { groupId }, select: { id: true } })).map((e) => e.id);

    await deleteInitiativesTx(tx, initiativeIds, summary, hooks);
    await deleteEstablishmentsTx(tx, establishmentIds, summary, hooks);
    await deleteOwned(tx, "groupe", [groupId], summary);
    await removeAssignments(tx, "groupe", [groupId], summary);
    await step(hooks, "groupe:objets");

    // ActorAffiliation → Group : cascade (les acteurs et les comptes restent).
    const res = await tx.group.deleteMany({ where: { id: groupId } });
    add(summary, "groupes", res.count);
    await step(hooks, "groupe:racine");
    await hooks?.inTx?.(tx, summary);
  }, TX_OPTIONS);
  return summary;
}

// Objets individuels (risque, action, décision, document, réunion, KPI).
export type SimpleKind = "risk" | "action" | "decision" | "document" | "meeting" | "kpi";

const LINKED_TYPE: Partial<Record<SimpleKind, string>> = { risk: "risque", action: "action", decision: "decision", meeting: "reunion" };

export async function deleteSimpleData(db: PrismaClient, kind: SimpleKind, id: string, hooks?: DeletionHooks): Promise<DeletionSummary> {
  const summary: DeletionSummary = { deleted: {}, blobUrls: [] };
  await db.$transaction(async (tx) => {
    // Les documents qui pointent vers l'objet (linkedType/linkedId, sans clé
    // étrangère) sont conservés : on retire seulement le lien devenu invalide.
    const linkedType = LINKED_TYPE[kind];
    if (linkedType) await tx.documentRef.updateMany({ where: { linkedType, linkedId: id }, data: { linkedType: null, linkedId: null } });
    await step(hooks, "simple:liens");

    // Actions/Risques/Décisions liés à une réunion, actions liées à un risque ou
    // une décision : SetNull (onDelete par défaut sur relation optionnelle).
    switch (kind) {
      case "risk": add(summary, "risques", (await tx.risk.deleteMany({ where: { id } })).count); break;
      case "action": add(summary, "actions", (await tx.action.deleteMany({ where: { id } })).count); break;
      case "decision": add(summary, "decisions", (await tx.decision.deleteMany({ where: { id } })).count); break;
      case "meeting": add(summary, "reunions", (await tx.meeting.deleteMany({ where: { id } })).count); break;
      case "kpi": add(summary, "indicateurs", (await tx.kpi.deleteMany({ where: { id } })).count); break;
      case "document": await deleteDocuments(tx, { id }, summary); break;
    }
    await step(hooks, "simple:racine");
    await hooks?.inTx?.(tx, summary);
  }, TX_OPTIONS);
  return summary;
}

// --- Aperçu (nombre d'éléments qui seront supprimés) ----------------------------------------

export type DeletionPreview = { label: string; counts: Record<string, number>; notes: string[] };

async function countsFor(db: PrismaClient, initiativeIds: string[], groupIds: string[], establishmentIds: string[]) {
  const byInit = { initiativeId: { in: initiativeIds } };
  const owned = {
    OR: [
      { initiativeId: { in: initiativeIds } },
      { ownerType: "groupe", ownerId: { in: groupIds } },
      { ownerType: "etablissement", ownerId: { in: establishmentIds } },
    ],
  };
  const ownerOnly = {
    OR: [
      { ownerType: "groupe", ownerId: { in: groupIds } },
      { ownerType: "etablissement", ownerId: { in: establishmentIds } },
    ],
  };
  const [actions, risques, decisions, documents, reunions, indicateurs, livrables, constats, exigences] = await Promise.all([
    db.action.count({ where: owned }),
    db.risk.count({ where: owned }),
    db.decision.count({ where: owned }),
    db.documentRef.count({ where: owned }),
    db.meeting.count({ where: byInit }),
    db.kpi.count({ where: byInit }),
    db.deliverable.count({ where: byInit }),
    db.auditFinding.count({ where: ownerOnly }),
    db.qualityRequirement.count({ where: ownerOnly }),
  ]);
  return { actions, risques, decisions, documents, reunions, indicateurs, livrables, constats_audit: constats, exigences_qualite: exigences };
}

export async function previewDeletion(db: PrismaClient, kind: "group" | "establishment" | "initiative", id: string): Promise<DeletionPreview | null> {
  if (kind === "initiative") {
    const i = await db.initiative.findUnique({ where: { id }, select: { name: true } });
    if (!i) return null;
    return { label: i.name, counts: await countsFor(db, [id], [], []), notes: ["Les acteurs partagés avec d'autres initiatives, groupes ou établissements sont conservés."] };
  }
  if (kind === "establishment") {
    const e = await db.establishment.findUnique({ where: { id }, select: { name: true } });
    if (!e) return null;
    const links = await db.initiativeEstablishment.findMany({ where: { establishmentId: id }, select: { initiativeId: true } });
    const orphaned = await db.initiative.count({ where: { id: { in: links.map((l) => l.initiativeId) }, establishments: { every: { establishmentId: id } } } });
    const counts = { ...(await countsFor(db, [], [], [id])), produits_installes: await db.installedProduct.count({ where: { establishmentId: id } }) };
    const notes = [`${links.length} initiative(s) perdent ce rattachement d'établissement (elles ne sont pas supprimées).`];
    if (orphaned > 0) notes.push(`${orphaned} initiative(s) n'auront plus aucun établissement rattaché.`);
    return { label: e.name, counts, notes };
  }
  const g = await db.group.findUnique({ where: { id }, select: { name: true } });
  if (!g) return null;
  const initiativeIds = (await db.initiative.findMany({ where: { groupId: id }, select: { id: true } })).map((x) => x.id);
  const establishmentIds = (await db.establishment.findMany({ where: { groupId: id }, select: { id: true } })).map((x) => x.id);
  const counts = {
    etablissements: establishmentIds.length,
    initiatives: initiativeIds.length,
    ...(await countsFor(db, initiativeIds, [id], establishmentIds)),
  };
  return { label: g.name, counts, notes: ["Les comptes utilisateurs sont conservés."] };
}
