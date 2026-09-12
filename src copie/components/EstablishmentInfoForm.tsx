"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EstablishmentInfo {
  id: string;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  siteWeb: string | null;
  activite: string | null;
  nombreLits: number | null;
  nombrePlaces: number | null;
  nombreUtilisateurs: number | null;
  dateSignature: string | null;
  dateDemarrage: string | null;
  dateFin: string | null;
  montantAnnuel: number | null;
  maintenance: string | null;
  support: string | null;
}

function toDateInput(v: string | null) {
  return v ? v.slice(0, 10) : "";
}

export function EstablishmentInfoForm({ establishment }: { establishment: EstablishmentInfo }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    adresse: establishment.adresse || "",
    ville: establishment.ville || "",
    pays: establishment.pays || "",
    siteWeb: establishment.siteWeb || "",
    activite: establishment.activite || "",
    nombreLits: establishment.nombreLits?.toString() || "",
    nombrePlaces: establishment.nombrePlaces?.toString() || "",
    nombreUtilisateurs: establishment.nombreUtilisateurs?.toString() || "",
    dateSignature: toDateInput(establishment.dateSignature),
    dateDemarrage: toDateInput(establishment.dateDemarrage),
    dateFin: toDateInput(establishment.dateFin),
    montantAnnuel: establishment.montantAnnuel?.toString() || "",
    maintenance: establishment.maintenance || "",
    support: establishment.support || "",
  });

  async function save() {
    await fetch(`/api/establishments/${establishment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-ink">Infos générales &amp; contrat</h3>
          <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>
            Modifier
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-ink/40">Adresse</dt>
            <dd>{establishment.adresse || "—"}{establishment.ville ? `, ${establishment.ville}` : ""}{establishment.pays ? ` (${establishment.pays})` : ""}</dd>
          </div>
          <div>
            <dt className="text-ink/40">Site web</dt>
            <dd>{establishment.siteWeb || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/40">Activité</dt>
            <dd>{establishment.activite || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/40">Capacité</dt>
            <dd>
              {establishment.nombreLits ? `${establishment.nombreLits} lits` : ""}
              {establishment.nombrePlaces ? ` · ${establishment.nombrePlaces} places` : ""}
              {establishment.nombreUtilisateurs ? ` · ${establishment.nombreUtilisateurs} utilisateurs` : ""}
              {!establishment.nombreLits && !establishment.nombrePlaces && !establishment.nombreUtilisateurs && "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink/40">Contrat</dt>
            <dd>
              {establishment.dateDemarrage ? `Démarré le ${toDateInput(establishment.dateDemarrage)}` : "—"}
              {establishment.dateFin ? ` · fin le ${toDateInput(establishment.dateFin)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ink/40">Montant annuel</dt>
            <dd>{establishment.montantAnnuel ? `${establishment.montantAnnuel.toLocaleString("fr-FR")} €` : "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/40">Maintenance</dt>
            <dd>{establishment.maintenance || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/40">Support</dt>
            <dd>{establishment.support || "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-medium text-ink">Infos générales &amp; contrat</h3>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Adresse" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} />
        <input className="input" placeholder="Ville" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} />
        <input className="input" placeholder="Pays" value={f.pays} onChange={(e) => setF({ ...f, pays: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Site web" value={f.siteWeb} onChange={(e) => setF({ ...f, siteWeb: e.target.value })} />
        <input className="input" placeholder="Activité" value={f.activite} onChange={(e) => setF({ ...f, activite: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <div className="label mb-1">Lits</div>
          <input className="input" type="number" value={f.nombreLits} onChange={(e) => setF({ ...f, nombreLits: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Places</div>
          <input className="input" type="number" value={f.nombrePlaces} onChange={(e) => setF({ ...f, nombrePlaces: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Utilisateurs</div>
          <input className="input" type="number" value={f.nombreUtilisateurs} onChange={(e) => setF({ ...f, nombreUtilisateurs: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <div className="label mb-1">Date de signature</div>
          <input className="input" type="date" value={f.dateSignature} onChange={(e) => setF({ ...f, dateSignature: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Date de démarrage</div>
          <input className="input" type="date" value={f.dateDemarrage} onChange={(e) => setF({ ...f, dateDemarrage: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Date de fin</div>
          <input className="input" type="date" value={f.dateFin} onChange={(e) => setF({ ...f, dateFin: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <div className="label mb-1">Montant annuel (€)</div>
          <input className="input" type="number" value={f.montantAnnuel} onChange={(e) => setF({ ...f, montantAnnuel: e.target.value })} />
        </label>
        <input className="input mt-5" placeholder="Maintenance" value={f.maintenance} onChange={(e) => setF({ ...f, maintenance: e.target.value })} />
        <input className="input mt-5" placeholder="Support" value={f.support} onChange={(e) => setF({ ...f, support: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={save}>
          Enregistrer
        </button>
        <button className="btn-secondary" onClick={() => setEditing(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
