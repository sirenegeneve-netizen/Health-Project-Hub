"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { callApi } from "./api";

export interface TypeRow {
  id: string;
  key: string;
  label: string;
  family: string;
  actif: boolean;
  archive: boolean;
  system: boolean;
  initiativeCount: number;
}

// Gestion des types : ajouter, renommer, désactiver, dupliquer, archiver. Jamais de suppression physique.
export function ProjectTypesManager({ types }: { types: TypeRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [family, setFamily] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const families = Array.from(new Set(types.map((t) => t.family)));
  const visible = types.filter((t) => showArchived || !t.archive);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) alert(res.error);
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await run("new", () => callApi("POST", "/api/project-types", { label, family: family || undefined }));
    setLabel("");
  }

  return (
    <div>
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 mb-6">
        <label className="block">
          <div className="label mb-1">Nouveau type</div>
          <input className="input w-64" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Renouvellement de DPI" />
        </label>
        <label className="block">
          <div className="label mb-1">Famille</div>
          <input className="input w-56" list="type-families" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Autres" />
          <datalist id="type-families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <button className="btn" disabled={busy === "new" || !label.trim()} type="submit">
          Ajouter
        </button>
      </form>

      <label className="flex items-center gap-2 text-sm text-ink/60 mb-3">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Afficher les types archivés
      </label>

      {families.map((fam) => {
        const rows = visible.filter((t) => t.family === fam);
        if (rows.length === 0) return null;
        return (
          <section key={fam} className="mb-6">
            <div className="label mb-2">{fam}</div>
            <div className="card divide-y divide-ink/5 !p-0">
              {rows.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink flex items-center gap-2 flex-wrap">
                      {t.label}
                      {t.archive ? <Pill text="Archivé" tone="neutral" /> : !t.actif ? <Pill text="Inactif" tone="warn" /> : <Pill text="Actif" tone="ok" />}
                    </div>
                    <div className="text-xs text-ink/45">
                      {t.initiativeCount} initiative{t.initiativeCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button
                      className="text-blue hover:underline disabled:opacity-50"
                      disabled={busy === t.id}
                      onClick={() => {
                        const next = prompt("Nouveau libellé du type :", t.label);
                        if (next && next.trim() && next !== t.label) run(t.id, () => callApi("PATCH", `/api/project-types/${t.id}`, { label: next }));
                      }}
                    >
                      Renommer
                    </button>
                    <button
                      className="text-blue hover:underline disabled:opacity-50"
                      disabled={busy === t.id}
                      onClick={() => {
                        const next = prompt("Libellé du type dupliqué :", `${t.label} (copie)`);
                        if (next && next.trim()) run(t.id, () => callApi("POST", "/api/project-types", { label: next, duplicateFromId: t.id }));
                      }}
                    >
                      Dupliquer
                    </button>
                    {!t.archive && (
                      <button className="text-blue hover:underline disabled:opacity-50" disabled={busy === t.id} onClick={() => run(t.id, () => callApi("PATCH", `/api/project-types/${t.id}`, { actif: !t.actif }))}>
                        {t.actif ? "Désactiver" : "Activer"}
                      </button>
                    )}
                    <button
                      className="text-blue hover:underline disabled:opacity-50"
                      disabled={busy === t.id}
                      onClick={() => {
                        if (!t.archive && !confirm(`Archiver « ${t.label} » ? Les initiatives existantes ne sont pas modifiées ; le type n'est plus proposé à la création.`)) return;
                        run(t.id, () => callApi("PATCH", `/api/project-types/${t.id}`, { archive: !t.archive }));
                      }}
                    >
                      {t.archive ? "Restaurer" : "Archiver"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
