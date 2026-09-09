// Calcule un libellé + un lien "Origine : …" pour une action, à partir de ses
// liens réels (meetingId / riskId / decisionId) plutôt que du seul champ texte
// `origine`. Le fil Réunion → Décision → Action → Risque (§7/8/9/10 du cahier
// des charges) devient ainsi visible partout où une action est affichée.

export interface ActionOriginInput {
  origine: string | null;
  meeting?: { id: string; title: string; date: Date } | null;
  risk?: { id: string; description: string } | null;
  decision?: { id: string; subject: string } | null;
}

export interface ActionOrigin {
  label: string;
  href: string | null;
}

const FALLBACK_LABEL: Record<string, string> = {
  mail: "Mail",
  document: "Document",
  manuel: "Saisie manuelle",
};

export function resolveActionOrigin(action: ActionOriginInput, projectId: string): ActionOrigin {
  if (action.meeting) {
    return {
      label: `Réunion du ${new Date(action.meeting.date).toLocaleDateString("fr-FR")}`,
      href: `/projects/${projectId}/meetings/${action.meeting.id}`,
    };
  }
  if (action.risk) {
    return {
      label: `Risque : ${truncate(action.risk.description, 40)}`,
      href: `/projects/${projectId}/risks`,
    };
  }
  if (action.decision) {
    return {
      label: `Décision : ${truncate(action.decision.subject, 40)}`,
      href: `/projects/${projectId}/decisions`,
    };
  }
  return { label: (action.origine && FALLBACK_LABEL[action.origine]) || "Non renseignée", href: null };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
