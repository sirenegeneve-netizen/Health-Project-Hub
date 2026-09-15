import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const group = await prisma.group.create({ data: { name: "GHT Exemple" } });

  const etab1 = await prisma.establishment.create({ data: { name: "CH Nord", groupId: group.id, type: "hopital", localisation: "Lille" } });
  const etab2 = await prisma.establishment.create({ data: { name: "CH Sud", groupId: group.id, type: "hopital", localisation: "Marseille" } });

  const initiative = await prisma.initiative.create({
    data: {
      reference: "PRJ-2026-001",
      name: "Déploiement DPI — CH Nord / CH Sud",
      description: "Déploiement du dossier patient informatisé sur les deux établissements du groupe.",
      type: "deploiement",
      groupId: group.id,
      chefDeProjet: "M. Lefèvre",
      sponsor: "Directrice des systèmes d'information",
      startDate: new Date("2026-03-01"),
      targetDate: new Date("2026-10-15"),
      phase: "tests",
      priority: "haute",
      budgetJh: 420,
      jhConsommes: 260,
      establishments: { create: [{ establishmentId: etab1.id }, { establishmentId: etab2.id }] },
    },
  });

  await prisma.planningBaseline.create({
    data: { initiativeId: initiative.id, label: "Baseline initiale", targetDate: new Date("2026-10-01") },
  });
  await prisma.planningBaseline.create({
    data: {
      initiativeId: initiative.id,
      label: "Révision COPIL",
      targetDate: new Date("2026-10-15"),
      reason: "Retard interface laboratoire",
    },
  });

  const interfaceLabo = await prisma.interface.create({
    data: {
      initiativeId: initiative.id,
      name: "Interface laboratoire",
      systemeSource: "SIL",
      systemeCible: "DPI",
      protocole: "HL7 v2",
      responsable: "Équipe interop",
      fournisseur: "Editeur SIL",
      status: "bloquant",
      isBlocking: true,
      datePrevue: new Date("2026-08-01"),
    },
  });

  await prisma.interface.create({
    data: {
      initiativeId: initiative.id,
      name: "Interface pharmacie",
      systemeSource: "DPI",
      systemeCible: "Logipharm",
      protocole: "HPRIM",
      responsable: "Équipe interop",
      status: "en_test",
      datePrevue: new Date("2026-07-15"),
    },
  });

  const risk = await prisma.risk.create({
    data: {
      initiativeId: initiative.id,
      description: "Recette incomplète suite au retard de l'interface laboratoire",
      cause: "Retard de livraison de l'interface laboratoire (+2 semaines)",
      consequence: "Décalage de la campagne de tests utilisateurs",
      probabilite: "forte",
      impact: "fort",
      criticite: "forte",
      proprietaire: "M. Lefèvre",
      planAction: "Prioriser les scénarios de test critiques, arbitrer la date de mise en production",
      interfaceId: interfaceLabo.id,
    },
  });

  await prisma.decision.create({
    data: {
      initiativeId: initiative.id,
      subject: "Arbitrage sur la date de mise en production",
      context: "Le retard de l'interface laboratoire impacte la recette et donc la date de Go-Live envisagée.",
      options: "Maintenir la date / Décaler de 2 semaines / Go-Live partiel sans le laboratoire",
      recommendation: "Décaler de 2 semaines pour sécuriser la recette",
      status: "arbitrage_necessaire",
    },
  });

  const meeting1 = await prisma.meeting.create({
    data: {
      initiativeId: initiative.id,
      type: "copil",
      title: "COPIL de suivi — Août 2026",
      date: new Date("2026-08-06T14:00:00"),
      participants: "Chef de projet, Sponsor, Référents établissements, Éditeur",
      agenda: "Point avancement, interfaces, planning, risques",
      notes: "L'éditeur du SIL confirme un retard de deux semaines sur l'interface laboratoire.",
    },
  });

  await prisma.action.create({
    data: {
      initiativeId: initiative.id,
      meetingId: meeting1.id,
      title: "Valider le mapping laboratoire avec l'éditeur",
      responsable: "Équipe interop",
      dateDebut: new Date("2026-08-06"),
      echeance: new Date("2026-08-20"),
      priority: "haute",
      origine: "reunion",
      status: "en_cours",
    },
  });

  await prisma.action.create({
    data: {
      initiativeId: initiative.id,
      title: "Préparer le plan de communication Go-Live",
      responsable: "Chef de projet",
      dateDebut: new Date("2026-06-15"),
      echeance: new Date("2026-07-01"),
      priority: "normale",
      origine: "manuel",
      status: "termine",
    },
  });

  await prisma.action.create({
    data: {
      initiativeId: initiative.id,
      title: "Recette fonctionnelle module urgences",
      responsable: "Équipe métier",
      dateDebut: new Date("2026-08-10"),
      echeance: new Date("2026-09-05"),
      priority: "haute",
      origine: "manuel",
      status: "a_faire",
    },
  });

  await prisma.vigilancePoint.create({
    data: { initiativeId: initiative.id, description: "Disponibilité du consultant interop en septembre à confirmer" },
  });

  const pop1 = await prisma.trainingRecord.create({
    data: {
      initiativeId: initiative.id,
      establishmentId: etab1.id,
      service: "Urgences",
      metier: "IDE",
      profil: "Utilisateur DPI",
      nbUsers: 60,
      nbFormes: 60,
      autonomyLevel: 2,
      referent: "C. Morel",
      referentContact: "c.morel@ch-nord.fr",
      dateFormation: new Date("2026-07-10"),
    },
  });
  const pop2 = await prisma.trainingRecord.create({
    data: {
      initiativeId: initiative.id,
      establishmentId: etab2.id,
      service: "Urgences",
      metier: "IDE",
      profil: "Utilisateur DPI",
      nbUsers: 45,
      nbFormes: 45,
      autonomyLevel: 1,
      dateFormation: new Date("2026-07-12"),
    },
  });

  await prisma.trainingSession.createMany({
    data: [
      { initiativeId: initiative.id, trainingRecordId: pop1.id, date: new Date("2026-07-08"), formateur: "Organisme XYZ", format: "presentiel", dureeHeures: 3, nbInscrits: 62, nbPresents: 58 },
      { initiativeId: initiative.id, trainingRecordId: pop1.id, date: new Date("2026-07-10"), formateur: "Organisme XYZ", format: "presentiel", dureeHeures: 3, nbInscrits: 20, nbPresents: 18 },
      { initiativeId: initiative.id, trainingRecordId: pop2.id, date: new Date("2026-07-12"), formateur: "Équipe interne", format: "distanciel", dureeHeures: 2, nbInscrits: 45, nbPresents: 32 },
    ],
  });

  await prisma.kpi.create({
    data: { initiativeId: initiative.id, name: "Tickets support / semaine", value: 14, unit: "tickets", target: 5, period: "Semaine post Go-Live", categorie: "adoption" },
  });

  await prisma.documentRef.create({
    data: {
      initiativeId: initiative.id,
      title: "Mail éditeur SIL — retard interface laboratoire",
      type: "mail",
      note: "La livraison de l'interface laboratoire est repoussée de deux semaines suite à un incident chez l'éditeur.",
    },
  });

  await prisma.backlogItem.create({
    data: {
      initiativeId: initiative.id,
      demande: "Ajout d'un tableau de bord infirmier personnalisable",
      origine: "atelier métier",
      priorite: "normale",
      estimationJh: 12,
      status: "nouveau",
    },
  });

  await prisma.initiative.update({ where: { id: initiative.id }, data: { budgetInitialEur: 250000, budgetReviseEur: 260000 } });

  await prisma.budgetLine.createMany({
    data: [
      { initiativeId: initiative.id, libelle: "Prestation intégrateur DPI", categorie: "prestation", fournisseur: "Éditeur DPI", prevision: 150000, engage: 150000, reel: 96000 },
      { initiativeId: initiative.id, libelle: "Licences additionnelles", categorie: "licence", prevision: 40000, engage: 40000, reel: 40000 },
      { initiativeId: initiative.id, libelle: "Déplacements équipe projet", categorie: "deplacement", prevision: 8000, engage: 5200, reel: 4100 },
    ],
  });

  await prisma.deliverable.create({
    data: { initiativeId: initiative.id, name: "Cahier des charges interopérabilité", responsable: "Équipe interop", version: "v1.2", status: "valide" },
  });
  await prisma.deliverable.create({
    data: { initiativeId: initiative.id, name: "Plan de déploiement", responsable: "Chef de projet", datePrevue: new Date("2026-09-15"), status: "en_cours" },
  });

  await prisma.stakeholder.create({
    data: { initiativeId: initiative.id, name: "Direction des soins", organisation: "CH Nord", role: "Sponsor métier", implication: "forte", influence: "forte" },
  });
  await prisma.stakeholder.create({
    data: { initiativeId: initiative.id, name: "Éditeur SIL", organisation: "Fournisseur", role: "Fournisseur interface", implication: "moyenne", influence: "forte" },
  });

  await prisma.kpi.create({
    data: { initiativeId: initiative.id, name: "Taux de satisfaction formation", value: 82, unit: "%", target: 90, period: "Juillet 2026" },
  });

  await prisma.changeRequest.create({
    data: {
      initiativeId: initiative.id,
      titre: "Ajout d'un connecteur bidirectionnel avec le logiciel de biologie délocalisée",
      origine: "audit",
      demandeur: "Direction des soins",
      justification: "Nouvelle exigence réglementaire suite à l'audit qualité de juin.",
      perimetre: "Module interopérabilité",
      impactFonctionnel: "Nouveau flux HL7 à spécifier",
      impactPlanningJours: 10,
      impactJh: 15,
      impactInterop: "Ajout d'une interface",
      decision: "en_etude",
    },
  });

  const actorCdp = await prisma.actor.create({
    data: { initiativeId: initiative.id, name: "M. Lefèvre", roleProjet: "chef_de_projet", fonction: "Chef de projet SI", disponibiliteJh: 40 },
  });
  const actorInterop = await prisma.actor.create({
    data: { initiativeId: initiative.id, name: "S. Nguyen", roleProjet: "consultant_interop", organisation: "Prestataire externe", disponibiliteJh: 15 },
  });
  const actorMetier = await prisma.actor.create({
    data: { initiativeId: initiative.id, name: "Dr. Aris", roleProjet: "expert_metier", fonction: "Médecin référent DPI", disponibiliteJh: 5 },
  });

  await prisma.raciEntry.createMany({
    data: [
      { initiativeId: initiative.id, actorId: actorCdp.id, activite: "Recette fonctionnelle", role: "A" },
      { initiativeId: initiative.id, actorId: actorInterop.id, activite: "Recette fonctionnelle", role: "R" },
      { initiativeId: initiative.id, actorId: actorMetier.id, activite: "Recette fonctionnelle", role: "C" },
      { initiativeId: initiative.id, actorId: actorCdp.id, activite: "Formation", role: "R" },
      { initiativeId: initiative.id, actorId: actorMetier.id, activite: "Formation", role: "I" },
      { initiativeId: initiative.id, actorId: actorCdp.id, activite: "Kick-off", role: "A" },
      { initiativeId: initiative.id, actorId: actorInterop.id, activite: "Interfaces", role: "R" },
      { initiativeId: initiative.id, actorId: actorCdp.id, activite: "Interfaces", role: "A" },
    ],
  });

  const reqLabo = await prisma.requirement.create({
    data: {
      initiativeId: initiative.id,
      titre: "Envoi automatique des résultats critiques aux urgences",
      description: "Les résultats de biologie critiques doivent générer une alerte visible côté urgences.",
      origine: "atelier_metier",
      priorite: "haute",
      statut: "retenu",
    },
  });
  await prisma.requirement.create({
    data: {
      initiativeId: initiative.id,
      titre: "Archivage des comptes rendus au format PDF/A",
      origine: "reglementaire",
      priorite: "normale",
      statut: "en_attente_arbitrage",
    },
  });

  await prisma.gap.create({
    data: {
      initiativeId: initiative.id,
      requirementId: reqLabo.id,
      description: "Le SIL ne supporte pas nativement les alertes temps réel demandées",
      optionsEnvisagees: "Développement spécifique éditeur / Contournement par polling toutes les 2 min / Report en V2",
      decisionRetenue: "Contournement par polling en attendant la V2 de l'éditeur",
      impact: "Délai d'alerte de 2 minutes au lieu du temps réel",
      statut: "arbitre",
    },
  });

  console.log("Seed terminé. Projet créé :", initiative.id);
  console.log("Risque lié à l'interface bloquante :", risk.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
