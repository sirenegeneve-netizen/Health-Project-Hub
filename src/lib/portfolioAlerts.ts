export type AlertLevel = "info" | "attention" | "critique";

export interface PortfolioAlert {
  level: AlertLevel;
  message: string;
  initiativeId: string;
  initiativeName: string;
  href: string;
}

export const ALERT_STYLES: Record<AlertLevel, { label: string; cls: string }> = {
  critique: { label: "🔴 Critique", cls: "bg-bad/10 text-bad" },
  attention: { label: "🟠 Attention", cls: "bg-warn/10 text-warn" },
  info: { label: "🟢 Information", cls: "bg-info-50 text-info" },
};

// Reformulation à 3 niveaux (au lieu des 4 précédents) des raisons déjà
// calculées par computeHealthScore — même logique de fond, vocabulaire aligné
// sur le prompt "Portefeuille = cockpit" §16.
export function severityFor(reason: string, level: "vert" | "orange" | "rouge"): AlertLevel {
  const r = reason.toLowerCase();
  if (level === "rouge" && (r.includes("bloquante") || r.includes("critique"))) return "critique";
  if (r.includes("retard") || r.includes("décision")) return "attention";
  return "info";
}

export function reasonHref(initiativeId: string, reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("retard")) return `/initiatives/${initiativeId}/actions`;
  if (r.includes("risque")) return `/initiatives/${initiativeId}/risks`;
  if (r.includes("décision")) return `/initiatives/${initiativeId}/decisions`;
  if (r.includes("interface") || r.includes("bloquante")) return `/initiatives/${initiativeId}/interfaces`;
  if (r.includes("budget")) return `/initiatives/${initiativeId}/budget`;
  if (r.includes("planning")) return `/initiatives/${initiativeId}/planning`;
  return `/initiatives/${initiativeId}`;
}

interface ActionLike {
  id: string;
  title: string;
  status: string;
  responsableActorId: string | null;
}

interface DeliverableLike {
  id: string;
  name: string;
  status: string;
  datePrevue: Date | null;
}

interface MeetingLike {
  id: string;
  title: string;
  date: Date;
  meetingParticipants: { actor: { id: string; name: string } }[];
}

interface RelationLike {
  type: string;
  initiativeCible: { id: string; name: string; targetDate: Date | null };
}

interface InitiativeForAlerts {
  id: string;
  name: string;
  targetDate: Date | null;
  actions: ActionLike[];
  deliverables: DeliverableLike[];
  meetings: MeetingLike[];
  relationsSource: RelationLike[];
}

const MEETING_WINDOW_MS = 60 * 60 * 1000;
const DELIVERABLE_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

// Nouvelles incohérences détectables avec les données déjà présentes, sans
// rien fabriquer (§5/§D du prompt Planning/Portefeuille).
export function computeAdditionalAlerts(initiatives: InitiativeForAlerts[]): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];

  // Absence de responsable sur une action non terminée.
  for (const p of initiatives) {
    for (const a of p.actions) {
      if (!a.responsableActorId && !["termine", "abandonne"].includes(a.status)) {
        alerts.push({
          level: "attention",
          message: `Action sans responsable : « ${a.title} »`,
          initiativeId: p.id,
          initiativeName: p.name,
          href: `/initiatives/${p.id}/actions`,
        });
      }
    }
  }

  // Livrable prévu sous 14 jours mais pas encore validé.
  const now = Date.now();
  for (const p of initiatives) {
    for (const d of p.deliverables) {
      if (d.datePrevue && d.status !== "valide") {
        const delta = d.datePrevue.getTime() - now;
        if (delta >= 0 && delta <= DELIVERABLE_HORIZON_MS) {
          alerts.push({
            level: "attention",
            message: `Livrable « ${d.name} » attendu sous 14 jours, non encore validé`,
            initiativeId: p.id,
            initiativeName: p.name,
            href: `/initiatives/${p.id}/conception`,
          });
        }
      }
    }
  }

  // Dépendance entre initiatives incompatible avec leur échéance respective :
  // A "dépend de" ou a pour "prérequis" B, mais A doit finir avant B.
  for (const p of initiatives) {
    for (const rel of p.relationsSource) {
      if (["depend_de", "prerequis_pour"].includes(rel.type) && p.targetDate && rel.initiativeCible.targetDate) {
        const target = rel.type === "depend_de" ? rel.initiativeCible : null;
        if (target && p.targetDate < target.targetDate!) {
          alerts.push({
            level: "critique",
            message: `« ${p.name} » dépend de « ${rel.initiativeCible.name} » mais son échéance est antérieure à celle de cette dernière`,
            initiativeId: p.id,
            initiativeName: p.name,
            href: `/initiatives/${p.id}/relations`,
          });
        }
      }
    }
  }

  // Réunions qui se chevauchent pour un même acteur, tous projets confondus.
  const allMeetings = initiatives.flatMap((p) => p.meetings.map((m) => ({ ...m, initiativeId: p.id, initiativeName: p.name })));
  const seenPairs = new Set<string>();
  for (let i = 0; i < allMeetings.length; i++) {
    for (let j = i + 1; j < allMeetings.length; j++) {
      const a = allMeetings[i];
      const b = allMeetings[j];
      if (Math.abs(a.date.getTime() - b.date.getTime()) > MEETING_WINDOW_MS) continue;
      const sharedActors = a.meetingParticipants
        .map((mp) => mp.actor)
        .filter((actor) => b.meetingParticipants.some((mp2) => mp2.actor.id === actor.id));
      if (sharedActors.length === 0) continue;
      const pairKey = [a.id, b.id].sort().join("-");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      alerts.push({
        level: "attention",
        message: `Réunion « ${a.title} » chevauche « ${b.title} » (${b.initiativeName}) — ${sharedActors.map((x) => x.name).join(", ")}`,
        initiativeId: a.initiativeId,
        initiativeName: a.initiativeName,
        href: `/initiatives/${a.initiativeId}/meetings`,
      });
    }
  }

  return alerts;
}
