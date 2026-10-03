"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { callApi } from "./api";

export interface TemplateRow {
  id: string;
  typeKey: string;
  name: string;
  version: number;
  status: string;
  isGeneral: boolean;
  stageCount: number;
  initiativeCount: number;
}

const STATUS: Record<string, { text: string; tone: "ok" | "warn" | "neutral" }> = {
  actif: { text: "Actif", tone: "ok" },
  brouillon: { text: "Brouillon", tone: "warn" },
  archive: { text: "Archivé", tone: "neutral" },
};

export function TemplatesManager({ types, templates }: { types: { key: string; label: string }[]; templates: TemplateRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState(types[0]?.key || "");
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string; data?: any }>, openAfter = false) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (openAfter && res.data?.id) router.push(`/settings/projects/templates/${res.data.id}`);
    else router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !typeKey) return;
    await run("new", () => callApi("POST", "/api/project-templates", { name, typeKey, sourceId: sourceId || undefined }), true);
  }

  const grouped = [
    { key: "defaut", label: "Modèle général (repli)", rows: templates.filter((t) => t.isGeneral) },
    ...types.map((t) => ({ key: t.key, label: t.label, rows: templates.filter((x) => !x.isGeneral && x.typeKey === t.key) })),
  ].filter((g) => g.rows.some((r) => showArchived || r.status !== "archive"));

  return (
    <div>
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 mb-6">
        <label className="block">
          <div className="label mb-1">Type de projet</div>
          <select className="input w-64" value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="label mb-1">Nom du modèle</div>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Déploiement DPI" />
        </label>
        <label className="block">
          <div className="label mb-1">Point de départ</div>
          <select className="input w-72" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Partir de zéro</option>
            {templates
              .filter((t) => t.status !== "archive")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  Dupliquer : {t.name} — V{t.version}
                </option>
              ))}
          </select>
        </label>
        <button className="btn" disabled={busy === "new" || !name.trim() || !typeKey} type="submit">
          Créer le modèle
        </button>
      </form>

      <label className="flex items-center gap-2 text-sm text-ink/60 mb-3">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Afficher les versions archivées
      </label>

      {grouped.map((g) => (
        <section key={g.key} className="mb-6">
          <div className="label mb-2">{g.label}</div>
          <div className="card divide-y divide-ink/5 !p-0">
            {g.rows
              .filter((r) => showArchived || r.status !== "archive")
              .map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/settings/projects/templates/${t.id}`} className="text-sm font-medium text-ink hover:underline">
                      {t.name} — V{t.version}
                    </Link>
                    <div className="text-xs text-ink/45 flex items-center gap-2 mt-0.5">
                      <Pill text={STATUS[t.status]?.text || t.status} tone={STATUS[t.status]?.tone || "neutral"} />
                      {t.stageCount} étape{t.stageCount > 1 ? "s" : ""} · {t.initiativeCount} initiative{t.initiativeCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <Link href={`/settings/projects/templates/${t.id}`} className="text-blue hover:underline">
                      Ouvrir
                    </Link>
                    {!t.isGeneral && (
                      <button
                        className="text-blue hover:underline disabled:opacity-50"
                        disabled={busy === t.id}
                        onClick={() => {
                          const next = prompt("Nom du modèle dupliqué :", `${t.name} (copie)`);
                          if (next && next.trim()) run(t.id, () => callApi("POST", "/api/project-templates", { name: next, typeKey: t.typeKey, sourceId: t.id }), true);
                        }}
                      >
                        Dupliquer
                      </button>
                    )}
                    {t.status !== "actif" && (
                      <button className="text-blue hover:underline disabled:opacity-50" disabled={busy === t.id} onClick={() => run(t.id, () => callApi("PATCH", `/api/project-templates/${t.id}`, { action: "activate" }))}>
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
