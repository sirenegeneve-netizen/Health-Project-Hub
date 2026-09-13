"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkActorSelector({
  currentActorId,
  actors,
}: {
  currentActorId: string | null;
  actors: { id: string; name: string; fonction: string | null }[];
}) {
  const router = useRouter();
  const [actorId, setActorId] = useState(currentActorId || "");
  const [saved, setSaved] = useState(false);

  async function save() {
    await fetch("/api/me/link-actor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: actorId || null }),
    });
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card max-w-md mt-6">
      <div className="font-medium text-sm mb-1">Mon identité dans le référentiel</div>
      <p className="text-sm text-muted mb-2">
        Reliez votre compte à votre fiche Acteur pour que « Mon activité » affiche automatiquement vos initiatives,
        actions et réunions, sans ressaisie.
      </p>
      <select
        className="input"
        value={actorId}
        onChange={(e) => {
          setActorId(e.target.value);
          setSaved(false);
        }}
      >
        <option value="">— Non relié —</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.fonction ? ` — ${a.fonction}` : ""}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3 mt-2">
        <button className="btn text-sm" onClick={save}>
          Enregistrer
        </button>
        {saved && <span className="text-xs text-ok">Enregistré.</span>}
      </div>
    </div>
  );
}
