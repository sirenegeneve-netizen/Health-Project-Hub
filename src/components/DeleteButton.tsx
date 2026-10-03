"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setFlash } from "@/components/FlashMessage";

export type DeleteKind = "group" | "establishment" | "initiative" | "risk" | "action" | "decision" | "document" | "meeting" | "kpi";

const ENDPOINTS: Record<DeleteKind, string> = {
  group: "groups",
  establishment: "establishments",
  initiative: "initiatives",
  risk: "risks",
  action: "actions",
  decision: "decisions",
  document: "documents",
  meeting: "meetings",
  kpi: "kpis",
};

const COUNT_LABELS: Record<string, string> = {
  etablissements: "établissement(s)",
  initiatives: "initiative(s)",
  actions: "action(s)",
  risques: "risque(s)",
  decisions: "décision(s)",
  documents: "document(s)",
  reunions: "réunion(s)",
  indicateurs: "indicateur(s)",
  livrables: "livrable(s)",
  constats_audit: "constat(s) d'audit",
  exigences_qualite: "exigence(s) qualité",
  produits_installes: "produit(s) installé(s)",
};

const IMPORTANT: DeleteKind[] = ["group", "establishment", "initiative"];

type Preview = { label: string; counts: Record<string, number>; notes: string[] };

// Bouton + boîte de confirmation de suppression, commun à toute l'application.
// La suppression est exécutée et contrôlée côté serveur : ce composant ne fait
// que demander et afficher le résultat.
export function DeleteButton({
  kind,
  id,
  redirectTo,
  className,
  children = "Supprimer",
}: {
  kind: DeleteKind;
  id: string;
  /** Page à ouvrir après suppression (obligatoire si l'on est sur la page de l'objet). */
  redirectTo?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const important = IMPORTANT.includes(kind);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setPreview(null);
    if (!important) return;
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/deletion-preview?kind=${kind}&id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPreview(data.preview);
      else if (res.status === 403) setError(data.error || "Accès refusé.");
    } catch {
      // l'aperçu est un plus : la confirmation reste possible sans lui
    } finally {
      setLoadingPreview(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${ENDPOINTS[kind]}/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "La suppression n'a pas pu être réalisée. Aucune donnée n'a été supprimée.");
        setBusy(false);
        return;
      }
      setFlash(data.alreadyGone ? "Cet élément avait déjà été supprimé." : "Suppression effectuée.");
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Connexion impossible. Aucune donnée n'a été supprimée ; réessayez.");
      setBusy(false);
    }
  }

  const counts = preview ? Object.entries(preview.counts).filter(([, n]) => n > 0) : [];

  return (
    <>
      <button type="button" onClick={openDialog} className={className ?? "text-xs text-red-600 hover:underline shrink-0"}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink">Supprimer{preview ? ` « ${preview.label} »` : ""} ?</h2>
            <p className="mt-2 text-sm text-ink/70">Êtes-vous sûr de vouloir supprimer cet élément ?</p>
            {important ? (
              <p className="mt-2 text-sm text-ink/70">
                Cette suppression supprimera également les données directement rattachées à cet élément. Cette action est irréversible.
                Les comptes utilisateurs sont conservés.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink/70">Cette action est irréversible.</p>
            )}
            {loadingPreview && <p className="mt-3 text-xs text-ink/50">Calcul des éléments concernés…</p>}
            {counts.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-ink/80">
                {counts.map(([k, n]) => (
                  <li key={k}>
                    {n} {COUNT_LABELS[k] ?? k}
                  </li>
                ))}
              </ul>
            )}
            {preview?.notes.map((n) => (
              <p key={n} className="mt-2 text-xs text-ink/60">
                {n}
              </p>
            ))}
            {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm">
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
