import { prisma } from "@/lib/db";
import { getWorkflowStages } from "@/lib/workflowStages";
import { InitiativeTabsClient, type SubTab } from "@/components/InitiativeTabsClient";

// Pour le Déploiement, le groupe "Parcours" garde ses 8 pages dédiées
// existantes (Kick-off, Préparation... chacune avec son propre contenu métier).
// Pour les 9 autres types, chaque étape a sa propre page (/etape/[key]) avec un
// texte de contexte adapté — mais affiche pour l'instant le même suivi
// transverse (Actions/Risques/Décisions/Réunions) que pour le Déploiement : pas
// encore de filtrage des éléments par étape (nécessiterait de taguer chaque
// action/risque/décision par étape à sa création).
const DEPLOIEMENT_PARCOURS: SubTab[] = [
  { href: "/kickoff", label: "Kick-off", match: ["/kickoff"] },
  { href: "/preparation", label: "Préparation", match: ["/preparation", "/conception", "/deliverables", "/changes", "/interfaces"] },
  { href: "/realisation", label: "Déploiement", match: ["/realisation", "/actions", "/planning", "/decisions", "/meetings"] },
  { href: "/validation", label: "Validation", match: ["/validation"] },
  { href: "/training", label: "Formation & Accomp.", match: ["/training"] },
  { href: "/golive", label: "Mise en production", match: ["/golive"] },
  { href: "/run", label: "Stabilisation", match: ["/run", "/kpis"] },
  { href: "/cloture", label: "Clôture", match: ["/cloture"] },
];

export async function InitiativeTabsServer({ initiativeId }: { initiativeId: string }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { type: true } });
  const type = initiative?.type || "deploiement";

  let parcoursChildren: SubTab[];
  if (type === "deploiement") {
    parcoursChildren = DEPLOIEMENT_PARCOURS;
  } else {
    const stages = await getWorkflowStages(type);
    parcoursChildren = stages.map((s) => ({ href: `/etape/${s.key}`, label: s.label, match: [`/etape/${s.key}`] }));
  }

  return <InitiativeTabsClient initiativeId={initiativeId} parcoursChildren={parcoursChildren} />;
}
