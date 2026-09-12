interface ActorOption {
  id: string;
  name: string;
}

export function ActorSelect({
  actors,
  value,
  onChange,
  placeholder = "— Non assigné —",
}: {
  actors: ActorOption[];
  value: string;
  onChange: (actorId: string) => void;
  placeholder?: string;
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {actors.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

// Multi-sélection (ex. participants d'une réunion) — cases à cocher plutôt
// qu'un <select multiple> peu lisible sur mobile.
export function ActorMultiSelect({
  actors,
  values,
  onChange,
}: {
  actors: ActorOption[];
  values: string[];
  onChange: (actorIds: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  }
  if (actors.length === 0) {
    return <p className="text-xs text-ink/40">Aucun acteur dans le référentiel de ce projet pour l'instant.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-line rounded-lg">
      {actors.map((a) => {
        const active = values.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active ? "bg-primary text-white border-primary" : "bg-white text-ink/60 border-line hover:border-primary/40"
            }`}
          >
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
