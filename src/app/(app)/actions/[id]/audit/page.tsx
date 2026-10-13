import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAuditPageData } from "@/lib/baselineAuditDb";
import { BaselineAuditForm } from "@/components/audit/BaselineAuditForm";
import { PERIMETRES_ORGANISATIONNELS, POPULATIONS, labelOf } from "@/lib/referentiels";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { a_faire: "À faire", en_cours: "En cours", en_attente: "En attente", termine: "Terminé", abandonne: "Abandonné" };

export default async function BaselineAuditPage({ params, searchParams }: { params: { id: string }; searchParams: { perimetre?: string } }) {
  const data = await loadAuditPageData(params.id, searchParams.perimetre);
  if (data.kind === "missing") return notFound();
  if (data.kind === "not_baseline") {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-3">{data.action.title}</h1>
        <div className="card text-sm">
          Cette action n'est pas une action d'audit de départ rattachée à un objectif : aucun formulaire d'audit n'est disponible.
          <div className="mt-3">
            <Link href="/actions" className="text-blue hover:underline">
              ← Retour aux actions
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const { action, objective, indicators } = data;
  const objectivePath = objective.ownerType === "groupe" ? `/groups/${objective.ownerId}/objectifs/${objective.cycleId}` : `/establishments/${objective.ownerId}/objectifs/${objective.cycleId}`;

  return (
    <div data-wide-page className="w-full">
      <Link href="/actions" className="text-sm text-blue hover:underline">
        ← Retour aux actions
      </Link>
      <h1 className="font-display text-2xl text-ink mt-2 mb-1">Audit de départ</h1>
      <p className="text-sm text-muted mb-4">{action.title}</p>

      <section className="card mb-4">
        <h2 className="font-display text-lg text-ink mb-2">Contexte</h2>
        <div className="grid lg:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="label">Objectif stratégique</div>
            <Link href={objectivePath} className="text-blue hover:underline">
              {objective.libelle}
            </Link>
            {objective.description && <p className="text-muted mt-1">{objective.description}</p>}
            {objective.resultatAttendu && (
              <p className="mt-1">
                <span className="label">Finalité / résultat attendu : </span>
                {objective.resultatAttendu}
              </p>
            )}
          </div>
          <div>
            <div className="label">Indicateur(s) à évaluer</div>
            <ul className="space-y-0.5">
              {indicators.map((i) => (
                <li key={i.id}>
                  {i.nom} <span className="text-muted">· unité {i.unite || "—"} · cible {i.valeurCible === null ? "—" : `${i.valeurCible}${i.unite ? ` ${i.unite}` : ""}`}</span>
                </li>
              ))}
              {indicators.length === 0 && <li className="text-muted">Aucun indicateur rattaché.</li>}
            </ul>
          </div>
          <div>
            <div className="label">Périmètre</div>
            <div>{objective.perimetreOrg.length ? objective.perimetreOrg.map((c) => labelOf(PERIMETRES_ORGANISATIONNELS, c)).join(" · ") : "—"}</div>
            {objective.populations.length > 0 && <div className="text-muted">{objective.populations.map((c) => labelOf(POPULATIONS, c)).join(" · ")}</div>}
            {objective.scopeEstablishments.length > 0 && <div className="text-muted">Établissements : {objective.scopeEstablishments.join(", ")}</div>}
            {objective.perimetre && <div className="text-muted">{objective.perimetre}</div>}
          </div>
          <div>
            <div className="label">Action</div>
            <div>
              Responsable : {action.responsable || "—"} · Échéance : {action.echeance ? new Date(action.echeance).toLocaleDateString("fr-FR") : "—"} · Statut : {STATUS[action.status] || action.status}
            </div>
            {action.livrable && <div className="text-muted">Résultat attendu : {action.livrable}</div>}
          </div>
        </div>
      </section>

      <BaselineAuditForm key={data.scopeKey} data={data} />
    </div>
  );
}
