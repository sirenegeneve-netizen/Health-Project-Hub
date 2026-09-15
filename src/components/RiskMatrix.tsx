const PROB_LEVELS = ["faible", "moyenne", "forte"];
const IMPACT_LEVELS = ["faible", "moyen", "fort"];

interface RiskLike {
  id: string;
  description: string;
  probabilite: string;
  impact: string;
  status: string;
}

export function RiskMatrix({ risks }: { risks: RiskLike[] }) {
  const active = risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  if (active.length === 0) return null;

  const cellFor = (prob: string, impact: string) => active.filter((r) => r.probabilite === prob && r.impact === impact);

  const severity = (probIdx: number, impactIdx: number) => probIdx + impactIdx;

  return (
    <div className="card mb-6">
      <div className="font-medium mb-3">Matrice des risques</div>
      <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1 text-sm">
        <div />
        {IMPACT_LEVELS.map((im) => (
          <div key={im} className="text-center text-xs text-ink/50 pb-1 capitalize">
            {im}
          </div>
        ))}
        {PROB_LEVELS.slice()
          .reverse()
          .map((prob, ri) => {
            const probIdx = PROB_LEVELS.length - 1 - ri;
            return (
              <div key={prob} className="contents">
                <div className="text-xs text-ink/50 flex items-center capitalize pr-2">{prob}</div>
                {IMPACT_LEVELS.map((impact, impactIdx) => {
                  const cellRisks = cellFor(prob, impact);
                  const sev = severity(probIdx, impactIdx);
                  const bg = sev >= 3 ? "bg-bad/15 border-bad/30" : sev === 2 ? "bg-warn/15 border-warn/30" : "bg-ok/10 border-ok/20";
                  return (
                    <div key={`${prob}-${impact}`} className={`min-h-16 rounded border p-1.5 ${bg}`}>
                      {cellRisks.map((r) => (
                        <div key={r.id} className="text-xs bg-white/70 rounded px-1.5 py-1 mb-1 last:mb-0 truncate" title={r.description}>
                          {r.description}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>
      <div className="text-xs text-ink/40 mt-2">Probabilité (lignes) × Impact (colonnes) — risques ouverts uniquement.</div>
    </div>
  );
}
