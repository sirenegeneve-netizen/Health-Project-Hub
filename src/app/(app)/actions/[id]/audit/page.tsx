import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { loadAuditPageData, type AuditPageData } from "@/lib/baselineAuditDb";
import { loadAccess, loadVisibility, recordScope } from "@/lib/access";
import { decide } from "@/lib/authzCore";
import { BaselineAuditForm } from "@/components/audit/BaselineAuditForm";
import { PERIMETRES_ORGANISATIONNELS, POPULATIONS, labelOf } from "@/lib/referentiels";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { a_faire: "À faire", en_cours: "En cours", en_attente: "En attente", termine: "Terminé", abandonne: "Abandonné" };

export default async function BaselineAuditPage({ params, searchParams }: { params: { id: string }; searchParams: { perimetre?: string } }) {
  const access = await loadAccess();
  if (!access) redirect("/login");
  // Qui voit l'audit : celui qui voit l'action du groupe (vue complète), sinon seulement les établissements de son périmètre.
  const actionScope = await recordScope(access.db, "action", params.id);
  const seesAction = decide(access.assignments, "voir", actionScope).allowed;
  const vis = await loadVisibility(access);
  const limits = access.mode === "enforce" && !seesAction ? { establishmentIds: vis.establishmentIds, global: false } : undefined;
  const loaded = await loadAuditPageData(params.id, searchParams.perimetre, limits);
  if (loaded.kind === "forbidden") return notFound();
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "not_baseline") {
    const notBaseline = loaded as { action?: { title: string } };
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-3">{notBaseline.action?.title}</h1>
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
  const data = loaded as AuditPageData;
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
