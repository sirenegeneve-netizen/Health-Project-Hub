import { prisma } from "@/lib/db";
import { getWorkflowStages } from "@/lib/workflowStages";
import { InitiativeTabsClient, type SubTab } from "@/components/InitiativeTabsClient";

// Pour le Déploiement, le groupe "Parcours" garde ses 8 pages dédiées
// existantes (Kick-off, Préparation... chacune avec son propre contenu métier).
// Pour les 9 autres types, il n'existe pas encore de page dédiée par étape
// (voir InitiativeJourney) — le sous-menu affiche donc les vraies étapes du
// type choisi, mais toutes renvoient vers la page de suivi transverse commune
// (Actions/Planning/Décisions/Réunions), pour rester honnête sur ce qui existe
// réellement plutôt que de fabriquer des destinations différentes.
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

const SUIVI_MATCH = ["/realisation", "/actions", "/planning", "/decisions", "/meetings"];

export async function InitiativeTabsServer({ initiativeId }: { initiativeId: string }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { type: true } });
  const type = initiative?.type || "deploiement";

  let parcoursChildren: SubTab[];
  if (type === "deploiement") {
    parcoursChildren = DEPLOIEMENT_PARCOURS;
  } else {
    const stages = await getWorkflowStages(type);
    // Toutes les étapes renvoient vers la même page de suivi transverse : pas
    // de page dédiée par étape pour ces types, donc pas de destination fictive.
    parcoursChildren = stages.map((s) => ({ href: "/realisation", label: s.label, match: SUIVI_MATCH }));
  }

  return <InitiativeTabsClient initiativeId={initiativeId} parcoursChildren={parcoursChildren} />;
}
