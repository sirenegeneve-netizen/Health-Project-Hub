"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["mail", "Mail"],
  ["compte_rendu", "Compte rendu"],
  ["specification", "Spécification"],
  ["recette", "Recette"],
  ["formation", "Formation"],
  ["interop", "Interopérabilité"],
  ["autre", "Autre"],
];

interface MailSuggestion {
  matchedInterfaces: string[];
  suggestRisk: boolean;
  suggestAction: boolean;
  suggestedActionTitle?: string;
  suggestedRiskDescription?: string;
}

export function DocumentTextImport({ initiativeId }: { initiativeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", type: "mail", note: "" });
  const [suggestion, setSuggestion] = useState<MailSuggestion | null>(null);

  async function create() {
    if (!f.title || !f.note) return;
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, initiativeId }),
    });
    const data = await res.json();
    const hasSomethingToShow = data.suggestions && (data.suggestions.suggestRisk || data.suggestions.suggestAction || data.suggestions.matchedInterfaces?.length);
    setSuggestion(hasSomethingToShow ? data.suggestions : null);
    setF({ title: "", type: "mail", note: "" });
    if (!hasSomethingToShow) setOpen(false);
    router.refresh();
  }

  return (
    <div>
      {!open && !suggestion && (
        <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
          + Coller un texte (mail, compte rendu...)
        </button>
      )}
      {open && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Titre" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input min-h-[100px]"
            placeholder="Collez le contenu ici..."
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="btn text-sm" onClick={create}>
              Importer
            </button>
            <button className="btn-secondary text-sm" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {suggestion && (
        <div className="mt-2 text-xs bg-teal-50 text-primary rounded-lg p-2">
          <div className="font-medium mb-1">Suggestions détectées dans le texte :</div>
          <ul className="list-disc list-inside space-y-0.5">
            {suggestion.matchedInterfaces.length > 0 && <li>Interface(s) mentionnée(s) : {suggestion.matchedInterfaces.join(", ")}</li>}
            {suggestion.suggestAction && suggestion.suggestedActionTitle && <li>Action à envisager : {suggestion.suggestedActionTitle}</li>}
            {suggestion.suggestRisk && suggestion.suggestedRiskDescription && <li>Risque à envisager : {suggestion.suggestedRiskDescription}</li>}
          </ul>
          <p className="mt-1 text-ink/50">Rien n'a été créé automatiquement — à vous de créer l'action/le risque si pertinent depuis les onglets correspondants.</p>
        </div>
      )}
    </div>
  );
}
