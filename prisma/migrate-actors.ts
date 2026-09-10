import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Migration ponctuelle (§3 des exigences complémentaires) : convertit les
// champs texte libres déjà saisis en relations réelles vers Actor, sans rien
// perdre. Pour chaque projet, un nom déjà présent dans le référentiel
// d'acteurs de CE projet est réutilisé ; sinon un nouvel acteur est créé avec
// ce nom (à compléter ensuite : rôle, email...).
//
// Idempotent : ne touche jamais une ligne dont le champ *ActorId est déjà
// renseigné, donc peut être relancé sans risque après une nouvelle saisie.
// Les champs texte legacy (responsable, proprietaire, formateur, referent,
// participants) ne sont PAS supprimés par ce script — ils restent en secours
// d'affichage tant qu'on n'a pas confirmé que tout est bien migré.

const norm = (s: string) => s.trim().toLowerCase();

async function findOrCreateActor(cache: Map<string, Map<string, string>>, projectId: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  if (!cache.has(projectId)) {
    const existing = await prisma.actor.findMany({ where: { projectId }, select: { id: true, name: true } });
    cache.set(projectId, new Map(existing.map((a) => [norm(a.name), a.id])));
  }
  const projectCache = cache.get(projectId)!;
  const key = norm(name);
  if (projectCache.has(key)) return projectCache.get(key)!;

  const created = await prisma.actor.create({ data: { projectId, name } });
  projectCache.set(key, created.id);
  return created.id;
}

async function main() {
  const cache = new Map<string, Map<string, string>>();
  let linked = 0;

  async function migrateActions() {
    const rows = await prisma.action.findMany({ where: { responsableActorId: null, responsable: { not: null } }, select: { id: true, projectId: true, responsable: true } });
    for (const r of rows) {
      if (!r.responsable || !r.responsable.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.responsable);
      await prisma.action.update({ where: { id: r.id }, data: { responsableActorId: actorId } });
      linked++;
    }
  }

  async function migrateRisks() {
    const rows = await prisma.risk.findMany({ where: { proprietaireActorId: null, proprietaire: { not: null } }, select: { id: true, projectId: true, proprietaire: true } });
    for (const r of rows) {
      if (!r.proprietaire || !r.proprietaire.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.proprietaire);
      await prisma.risk.update({ where: { id: r.id }, data: { proprietaireActorId: actorId } });
      linked++;
    }
  }

  async function migrateInterfaces() {
    const rows = await prisma.interface.findMany({ where: { responsableActorId: null, responsable: { not: null } }, select: { id: true, projectId: true, responsable: true } });
    for (const r of rows) {
      if (!r.responsable || !r.responsable.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.responsable);
      await prisma.interface.update({ where: { id: r.id }, data: { responsableActorId: actorId } });
      linked++;
    }
  }

  async function migrateDeliverables() {
    const rows = await prisma.deliverable.findMany({ where: { responsableActorId: null, responsable: { not: null } }, select: { id: true, projectId: true, responsable: true } });
    for (const r of rows) {
      if (!r.responsable || !r.responsable.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.responsable);
      await prisma.deliverable.update({ where: { id: r.id }, data: { responsableActorId: actorId } });
      linked++;
    }
  }

  async function migrateDecisions() {
    const rows = await prisma.decision.findMany({ where: { decideurActorId: null, decideur: { not: null } }, select: { id: true, projectId: true, decideur: true } });
    for (const r of rows) {
      if (!r.decideur || !r.decideur.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.decideur);
      await prisma.decision.update({ where: { id: r.id }, data: { decideurActorId: actorId } });
      linked++;
    }
  }

  async function migrateTrainingSessions() {
    const rows = await prisma.trainingSession.findMany({ where: { formateurActorId: null, formateur: { not: null } }, select: { id: true, projectId: true, formateur: true } });
    for (const r of rows) {
      if (!r.formateur || !r.formateur.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.formateur);
      await prisma.trainingSession.update({ where: { id: r.id }, data: { formateurActorId: actorId } });
      linked++;
    }
  }

  async function migrateTrainingRecords() {
    const rows = await prisma.trainingRecord.findMany({ where: { referentActorId: null, referent: { not: null } }, select: { id: true, projectId: true, referent: true } });
    for (const r of rows) {
      if (!r.referent || !r.referent.trim()) continue;
      const actorId = await findOrCreateActor(cache, r.projectId, r.referent);
      await prisma.trainingRecord.update({ where: { id: r.id }, data: { referentActorId: actorId } });
      linked++;
    }
  }

  async function migrateMeetingParticipants() {
    const meetings = await prisma.meeting.findMany({ where: { participants: { not: null } }, select: { id: true, projectId: true, participants: true } });
    for (const m of meetings) {
      if (!m.participants || !m.participants.trim()) continue;
      const names = m.participants
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      for (const name of names) {
        const actorId = await findOrCreateActor(cache, m.projectId, name);
        await prisma.meetingParticipant.upsert({
          where: { meetingId_actorId: { meetingId: m.id, actorId } },
          create: { meetingId: m.id, actorId },
          update: {},
        });
        linked++;
      }
    }
  }

  await migrateActions();
  await migrateRisks();
  await migrateInterfaces();
  await migrateDeliverables();
  await migrateDecisions();
  await migrateTrainingSessions();
  await migrateTrainingRecords();
  await migrateMeetingParticipants();

  const totalActorsAfter = await prisma.actor.count();
  console.log(`Migration terminée. ${linked} lien(s) créé(s) vers le référentiel d'acteurs.`);
  console.log(`${totalActorsAfter} acteur(s) au total dans le référentiel (nouveaux compris).`);
  console.log("Les champs texte d'origine n'ont pas été supprimés — vérifiez le résultat avant toute suppression.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
