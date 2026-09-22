"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["hopital", "Hôpital"],
  ["clinique", "Clinique"],
  ["ehpad", "EHPAD"],
  ["cabinet", "Cabinet"],
  ["ght", "GHT"],
  ["autre", "Autre"],
];

const STATUSES = [
  ["actif", "Actif"],
  ["inactif", "Inactif"],
];

// groupId : quand fourni (ex. depuis la fiche d'un groupe), le rattachement
// est fixé et non modifiable. Sinon, `groups` doit être fourni pour permettre
// de choisir explicitement le groupe (ex. page /establishments, tous groupes confondus).
//
// Formulaire progressif : seuls Nom / Type / Groupe / Localisation / Statut sont
// demandés d'entrée. Les contacts, le périmètre SI et le contrat se complètent
// ensuite depuis les onglets de la fiche établissement (rien à ressaisir).
export function EstablishmentForm({ groupId, groups }: { groupId?: string; groups?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    type: "hopital",
    status: "actif",
    localisation: "",
    groupId: groupId || groups?.[0]?.id || "",
    adresse: "",
    ville: "",
    pays: "",
    siteWeb: "",
    activite: "",
    nombreLits: "",
    nombrePlaces: "",
    nombreUtilisateurs: "",
  });

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Nouvel établissement
      </button>
    );
  }

  const noGroupAvailable = !groupId && (!groups || groups.length === 0);

  if (noGroupAvailable) {
    return (
      <div className="card mb-4 space-y-3">
        <p className="text-sm text-bad">Créez d'abord un groupe (page Groupes) avant de pouvoir créer un établissement.</p>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Nom</div>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Type</div>
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!groupId && groups && (
          <label className="block">
            <div className="label mb-1">Groupe</div>
            <select className="input" value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <div className="label mb-1">Statut</div>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <div className="label mb-1">Localisation</div>
        <input className="input" value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ville, région…" />
      </label>

      <button type="button" className="text-xs text-blue hover:underline" onClick={() => setMore(!more)}>
        {more ? "− Masquer les informations complémentaires" : "+ Informations complémentaires (optionnel)"}
      </button>

      {more && (
        <div className="space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="label mb-1">Adresse</div>
              <input className="input" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Ville</div>
              <input className="input" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="label mb-1">Pays</div>
              <input className="input" value={f.pays} onChange={(e) => setF({ ...f, pays: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Site web</div>
              <input className="input" value={f.siteWeb} onChange={(e) => setF({ ...f, siteWeb: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <div className="label mb-1">Activité</div>
            <input className="input" value={f.activite} onChange={(e) => setF({ ...f, activite: e.target.value })} />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <div className="label mb-1">Nombre de lits</div>
              <input className="input" type="number" value={f.nombreLits} onChange={(e) => setF({ ...f, nombreLits: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Nombre de places</div>
              <input className="input" type="number" value={f.nombrePlaces} onChange={(e) => setF({ ...f, nombrePlaces: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Utilisateurs</div>
              <input className="input" type="number" value={f.nombreUtilisateurs} onChange={(e) => setF({ ...f, nombreUtilisateurs: e.target.value })} />
            </label>
          </div>
          <p className="text-xs text-ink/40">
            Contacts, périmètre SI et informations de contrat se complètent ensuite depuis la fiche de l'établissement.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy || !f.name || !f.groupId}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/establishments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...f,
                  nombreLits: f.nombreLits || undefined,
                  nombrePlaces: f.nombrePlaces || undefined,
                  nombreUtilisateurs: f.nombreUtilisateurs || undefined,
                }),
              });
              const created = await res.json();
              setOpen(false);
              if (created?.id) {
                router.push(`/establishments/${created.id}?onboarding=1`);
              } else {
                router.refresh();
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
