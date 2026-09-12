"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  deploiement: "Déploiement",
  evolution: "Évolution",
  interoperabilite: "Interopérabilité",
  migration: "Migration",
  mise_a_niveau: "Mise à niveau",
  cybersecurite: "Cybersécurité",
  reglementaire: "Réglementaire",
  formation: "Formation",
  audit: "Audit",
  autre: "Autre",
};

const RELATION_LABELS: Record<string, string> = {
  depend_de: "Dépend de",
  prerequis_pour: "Prérequis pour",
  impacte: "Impacte",
  lie_a: "Liée à",
  conflit_avec: "En conflit avec",
  ressource_partagee_avec: "Ressource partagée avec",
};

export interface RelatedTypeSuggestion {
  id: string;
  relatedType: string;
  relationType: string;
  reason: string | null;
}

export function SuggestedRelatedInitiatives({
  initiativeId,
  initiativeName,
  suggestions,
}: {
  initiativeId: string;
  initiativeName: string;
  suggestions: RelatedTypeSuggestion[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reference: string; name: string }>>({});
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  if (suggestions.length === 0) return null;
  const visible = suggestions.filter((s) => !dismissed.includes(s.id));
  if (visible.length === 0) return null;

  function draftFor(s: RelatedTypeSuggestion) {
    return drafts[s.id] || { reference: "", name: `${TYPE_LABELS[s.relatedType] || s.relatedType} — ${initiativeName}` };
  }

  async function create(s: RelatedTypeSuggestion) {
    const d = draftFor(s);
    if (!d.reference || !d.name) return;
    setSaving(true);
    const res = await fetch("/api/initiatives/linked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceInitiativeId: initiativeId,
        relatedType: s.relatedType,
        relationType: s.relationType,
        reference: d.reference,
        name: d.name,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpenId(null);
      router.refresh();
    }
  }

  return (
    <div className="card">
      <h3 className="font-medium text-ink mb-1">Initiatives suggérées pour ce type</h3>
      <p className="text-xs text-ink/50 mb-3">Ce type de projet nécessite généralement les volets suivants. À toi de décider si c'est pertinent ici.</p>
      <ul className="space-y-3">
        {visible.map((s) => (
          <li key={s.id} className="border-b border-line/60 pb-3 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">{TYPE_LABELS[s.relatedType] || s.relatedType}</span>
                {s.reason && <span className="text-ink/50"> — {s.reason}</span>}
              </div>
              {openId !== s.id && (
                <div className="flex gap-2 shrink-0">
                  <button className="text-xs text-blue hover:underline" onClick={() => setOpenId(s.id)}>
                    + Créer et lier
                  </button>
                  <button className="text-xs text-ink/40 hover:underline" onClick={() => setDismissed((prev) => [...prev, s.id])}>
                    Ignorer
                  </button>
                </div>
              )}
            </div>

            {openId === s.id && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Référence"
                  value={draftFor(s).reference}
                  onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...draftFor(s), reference: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="Nom"
                  value={draftFor(s).name}
                  onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...draftFor(s), name: e.target.value } })}
                />
                <div className="col-span-2 flex items-center gap-2">
                  <button className="btn text-sm" disabled={saving} onClick={() => create(s)}>
                    {saving ? "Création…" : `Créer (${RELATION_LABELS[s.relationType] || s.relationType})`}
                  </button>
                  <button className="btn-secondary text-sm" onClick={() => setOpenId(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
