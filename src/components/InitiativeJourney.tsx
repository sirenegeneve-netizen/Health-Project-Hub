import Link from "next/link";
import type { Stage } from "@/lib/lifecycle";

const ROUTE_BY_STAGE: Record<string, string> = {
  cadrage: "cadrage",
  kickoff: "kickoff",
  preparation: "preparation",
  deploiement: "realisation",
  validation: "validation",
  formation_accompagnement: "training",
  mise_en_production: "golive",
  stabilisation: "run",
  cloture: "cloture",
};

const DOT: Record<Stage["status"], string> = {
  done: "bg-ok text-white",
  current: "bg-warn text-white",
  upcoming: "bg-ink/10 text-ink/40",
};

export interface JourneyAlert {
  label: string;
  href: string;
  tone: "bad" | "warn";
}

// Vue "parcours de certification" du projet (§15 du prompt de refonte) :
// remplace l'ancien PhaseRail par une frise cliquable avec % d'avancement
// global et les alertes agrégées juste en dessous — l'écran que le chef de
// projet doit comprendre en moins de 5 secondes.
export function InitiativeJourney({ initiativeId, stages, alerts }: { initiativeId: string; stages: Stage[]; alerts: JourneyAlert[] }) {
  const doneCount = stages.filter((s) => s.status === "done").length;
  const currentStage = stages.find((s) => s.status === "current");
  const percent = Math.round(((doneCount + (currentStage ? 0.5 : 0)) / stages.length) * 100);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted">
          Étape actuelle : <span className="font-medium text-ink">{currentStage?.label || "—"}</span>
        </div>
        <div className="text-sm font-medium text-ink">{percent}% du parcours</div>
      </div>

      <div className="flex items-start overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const route = ROUTE_BY_STAGE[s.key];
          const content = (
            <>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${DOT[s.status]} ${route ? "group-hover:opacity-80" : ""}`}
              >
                {s.status === "done" ? "✓" : i + 1}
              </span>
              <span className={`text-[11px] text-center leading-tight ${s.status === "current" ? "text-ink font-medium" : "text-muted"}`}>
                {s.label}
              </span>
            </>
          );
          return (
            <div key={s.key} className="flex items-center">
              {route ? (
                <Link href={`/initiatives/${initiativeId}/${route}`} className="flex flex-col items-center gap-1.5 w-[86px] shrink-0 group">
                  {content}
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-1.5 w-[86px] shrink-0" title="Pas encore de page dédiée à cette étape">
                  {content}
                </div>
              )}
              {i < stages.length - 1 && <span className={`h-px w-6 mt-[-14px] shrink-0 ${s.status === "done" ? "bg-ok" : "bg-ink/10"}`} />}
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-4 border-t border-ink/5">
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} className={`text-sm hover:underline ${a.tone === "bad" ? "text-bad" : "text-warn"}`}>
              {a.tone === "bad" ? "🔴" : "🟠"} {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
