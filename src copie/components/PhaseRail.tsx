import { computeStages, DEFAULT_STAGES } from "@/lib/lifecycle";

// NB : superseded par InitiativeJourney (voir ce composant). Conservé pour
// compat mais utilise désormais le socle par défaut (Déploiement) faute de
// connaître le type d'initiative — passer par InitiativeJourney pour un
// rendu correctement propre au type.
const DOT: Record<string, string> = {
  done: "bg-ok",
  current: "bg-warn",
  upcoming: "bg-ink/15",
};

export function PhaseRail({ phase }: { phase: string }) {
  const stages = computeStages(phase, DEFAULT_STAGES);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      {stages.map((s, i) => (
        <span key={s.key} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT[s.status]}`} />
            <span className={s.status === "current" ? "text-ink font-medium" : "text-muted"}>{s.label}</span>
          </span>
          {i < stages.length - 1 && <span className="text-ink/15">→</span>}
        </span>
      ))}
    </div>
  );
}
