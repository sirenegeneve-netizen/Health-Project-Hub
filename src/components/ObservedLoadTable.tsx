export function ObservedLoadTable({
  weeks,
  actors,
  totals,
}: {
  weeks: { start: string; label: string }[];
  actors: { id: string; name: string }[];
  totals: Record<string, Record<string, number>>; // actorId -> weekStart -> heures
}) {
  const activeActors = actors.filter((a) => weeks.some((w) => (totals[a.id]?.[w.start] || 0) > 0));

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg text-ink mb-1">Charge constatée</h2>
      <p className="text-sm text-muted mb-3">
        Calculée automatiquement à partir des réunions (avec heure de fin), sessions de formation et livrables programmés, selon qui y est
        rattaché — en heures, indépendamment des jours-homme déclarés ci-dessus. Un événement sans heure de fin renseignée n'est pas compté.
      </p>
      {activeActors.length === 0 ? (
        <div className="card text-center text-muted py-8 text-sm">
          Aucune charge constatée sur cette période — renseignez une heure de fin sur vos réunions, formations ou livrables programmés pour
          qu'elle apparaisse ici.
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4 sticky left-0 bg-teal-50/50">Acteur</th>
                {weeks.map((w) => (
                  <th key={w.start} className="text-center whitespace-nowrap px-2">
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeActors.map((a) => (
                <tr key={a.id}>
                  <td className="pl-4 font-medium whitespace-nowrap sticky left-0 bg-white">{a.name}</td>
                  {weeks.map((w) => {
                    const h = totals[a.id]?.[w.start] || 0;
                    return (
                      <td key={w.start} className="text-center text-xs text-ink/70 py-2">
                        {h > 0 ? `${h.toFixed(1)} h` : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
