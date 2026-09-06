"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectDescriptionEditor({ projectId, initial }: { projectId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);

  async function save() {
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: value }),
    });
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <textarea
        className="input"
        rows={3}
        placeholder="Objectifs, périmètre, besoins exprimés au démarrage du projet…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => !saved && save()}
      />
      {!saved && <div className="text-xs text-muted mt-1">Enregistrement en quittant le champ…</div>}
    </div>
  );
}
