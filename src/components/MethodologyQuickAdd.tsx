"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bouton "+" minimaliste pour ajouter au registre un risque ou un livrable
// typique proposé par la fiche méthode, sans repasser par le formulaire complet.
export function MethodologyQuickAdd({
  initiativeId,
  kind,
  label,
  description,
  probabilite,
  impact,
}: {
  initiativeId: string;
  kind: "risque" | "livrable";
  label: string;
  description?: string | null;
  probabilite?: string | null;
  impact?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <span className="text-xs text-primary">Ajouté ✓</span>;

  return (
    <button
      className="text-xs text-blue hover:underline disabled:opacity-50"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        const url = kind === "risque" ? "/api/risks" : "/api/deliverables";
        const body =
          kind === "risque"
            ? { initiativeId, description: label, cause: description || null, probabilite: probabilite || "moyenne", impact: impact || "moyen" }
            : { initiativeId, name: label, description: description || null };
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        setSaving(false);
        setDone(true);
        router.refresh();
      }}
    >
      {saving ? "Ajout…" : "+ Ajouter au registre"}
    </button>
  );
}
