import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const group = await prisma.group.create({ data: { name: "GHT Exemple" } });

  const etab1 = await prisma.establishment.create({ data: { name: "CH Nord", groupId: group.id } });
  const etab2 = await prisma.establishment.create({ data: { name: "CH Sud", groupId: group.id } });

  const project = await prisma.project.create({
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
    data: { projectId: project.id, label: "Baseline initiale", targetDate: new Date("2026-10-01") },
  });
  await prisma.planningBaseline.create({
    data: {
      projectId: project.id,
      label: "Révision COPIL",
      targetDate: new Date("2026-10-15"),
      reason: "Retard interface laboratoire",
    },
  });

  const interfaceLabo = await prisma.interface.create({
    data: {
      projectId: project.id,
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
      projectId: project.id,
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
      projectId: project.id,
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
      projectId: project.id,
      subject: "Arbitrage sur la date de mise en production",
      context: "Le retard de l'interface laboratoire impacte la recette et donc la date de Go-Live envisagée.",
      options: "Maintenir la date / Décaler de 2 semaines / Go-Live partiel sans le laboratoire",
      recommendation: "Décaler de 2 semaines pour sécuriser la recette",
      status: "arbitrage_necessaire",
    },
  });

  const meeting1 = await prisma.meeting.create({
    data: {
      projectId: project.id,
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
      projectId: project.id,
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
      projectId: project.id,
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
      projectId: project.id,
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
    data: { projectId: project.id, description: "Disponibilité du consultant interop en septembre à confirmer" },
  });

  await prisma.trainingRecord.create({
    data: {
      projectId: project.id,
      establishmentId: etab1.id,
      service: "Urgences",
      metier: "IDE",
      profil: "Utilisateur DPI",
      nbUsers: 60,
      nbFormes: 60,
      autonomyLevel: 2,
      dateFormation: new Date("2026-07-10"),
    },
  });
  await prisma.trainingRecord.create({
    data: {
      projectId: project.id,
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

  await prisma.documentRef.create({
    data: {
      projectId: project.id,
      title: "Mail éditeur SIL — retard interface laboratoire",
      type: "mail",
      note: "La livraison de l'interface laboratoire est repoussée de deux semaines suite à un incident chez l'éditeur.",
    },
  });

  await prisma.backlogItem.create({
    data: {
      projectId: project.id,
      demande: "Ajout d'un tableau de bord infirmier personnalisable",
      origine: "atelier métier",
      priorite: "normale",
      estimationJh: 12,
      status: "nouveau",
    },
  });

  await prisma.project.update({ where: { id: project.id }, data: { budgetInitialEur: 250000, budgetReviseEur: 260000 } });

  await prisma.budgetLine.createMany({
    data: [
      { projectId: project.id, libelle: "Prestation intégrateur DPI", categorie: "prestation", fournisseur: "Éditeur DPI", prevision: 150000, engage: 150000, reel: 96000 },
      { projectId: project.id, libelle: "Licences additionnelles", categorie: "licence", prevision: 40000, engage: 40000, reel: 40000 },
      { projectId: project.id, libelle: "Déplacements équipe projet", categorie: "deplacement", prevision: 8000, engage: 5200, reel: 4100 },
    ],
  });

  await prisma.deliverable.create({
    data: { projectId: project.id, name: "Cahier des charges interopérabilité", responsable: "Équipe interop", version: "v1.2", status: "valide" },
  });
  await prisma.deliverable.create({
    data: { projectId: project.id, name: "Plan de déploiement", responsable: "Chef de projet", datePrevue: new Date("2026-09-15"), status: "en_cours" },
  });

  await prisma.stakeholder.create({
    data: { projectId: project.id, name: "Direction des soins", organisation: "CH Nord", role: "Sponsor métier", implication: "forte", influence: "forte" },
  });
  await prisma.stakeholder.create({
    data: { projectId: project.id, name: "Éditeur SIL", organisation: "Fournisseur", role: "Fournisseur interface", implication: "moyenne", influence: "forte" },
  });

  await prisma.kpi.create({
    data: { projectId: project.id, name: "Taux de satisfaction formation", value: 82, unit: "%", target: 90, period: "Juillet 2026" },
  });

  await prisma.changeRequest.create({
    data: {
      projectId: project.id,
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
    data: { projectId: project.id, name: "M. Lefèvre", roleProjet: "chef_de_projet", fonction: "Chef de projet SI", disponibiliteJh: 40 },
  });
  const actorInterop = await prisma.actor.create({
    data: { projectId: project.id, name: "S. Nguyen", roleProjet: "consultant_interop", organisation: "Prestataire externe", disponibiliteJh: 15 },
  });
  const actorMetier = await prisma.actor.create({
    data: { projectId: project.id, name: "Dr. Aris", roleProjet: "expert_metier", fonction: "Médecin référent DPI", disponibiliteJh: 5 },
  });

  await prisma.raciEntry.createMany({
    data: [
      { projectId: project.id, actorId: actorCdp.id, activite: "Recette laboratoire", role: "A" },
      { projectId: project.id, actorId: actorInterop.id, activite: "Recette laboratoire", role: "R" },
      { projectId: project.id, actorId: actorMetier.id, activite: "Recette laboratoire", role: "C" },
      { projectId: project.id, actorId: actorCdp.id, activite: "Formation utilisateurs", role: "R" },
      { projectId: project.id, actorId: actorMetier.id, activite: "Formation utilisateurs", role: "I" },
    ],
  });

  console.log("Seed terminé. Projet créé :", project.id);
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
