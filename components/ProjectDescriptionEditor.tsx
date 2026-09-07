"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Champ texte éditable en ligne pour les rubriques de cadrage (contexte, enjeux,
// objectifs, périmètre...). Un composant générique paramétré par le nom du champ,
// plutôt que d'en dupliquer un par rubrique.
export function EditableField({
  projectId,
  field,
  label,
  placeholder,
  initial,
  rows = 3,
}: {
  projectId: string;
  field: string;
  label: string;
  placeholder?: string;
  initial: string;
  rows?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);

  async function save() {
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <div className="label mb-1">{label}</div>
      <textarea
        className="input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => !saved && save()}
      />
    </div>
  );
}

// Conservé pour compatibilité — équivalent à EditableField pour la description/contexte.
export function ProjectDescriptionEditor({ projectId, initial }: { projectId: string; initial: string }) {
  return (
    <EditableField
      projectId={projectId}
      field="description"
      label="Contexte"
      placeholder="Pourquoi ce projet, dans quel contexte ?"
      initial={initial}
    />
  );
}
