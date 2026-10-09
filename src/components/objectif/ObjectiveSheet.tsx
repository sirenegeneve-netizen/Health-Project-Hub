import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Pill } from "@/components/Pill";
import { formatProgress, formatTarget } from "@/lib/objectifs";
import { loadDocumentCandidates, loadInitiativeCandidates, loadLinkCandidates, loadObjectiveDetail, loadObjectiveHistory } from "@/lib/objectifsDb";
import { ObjectiveActionsSection } from "@/components/objectif/ObjectiveActionsSection";
import { AssociationSection } from "@/components/objectif/AssociationSection";
import { DiffuseObjectiveButton } from "@/components/objectif/DiffuseObjectiveButton";
import { IndicatorsSection, type IndicatorView } from "@/components/objectif/IndicatorsSection";
import { ObjectiveHeaderControls } from "@/components/objectif/ObjectiveHeaderControls";

const STATUT_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { actif: "ok", atteint: "ok", reporte: "warn", abandonne: "neutral" };
const STATUT_LABEL: Record<string, string> = { actif: "Actif", atteint: "Atteint", reporte: "Reporté", abandonne: "Abandonné" };
const PRIORITE_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { basse: "neutral", normale: "neutral", haute: "warn", critique: "bad" };

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg text-ink">{children}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function basisText(p: { basis: string | null; measured: number; total: number }): string {
  if (p.basis === "indicateurs") return p.measured === 0 ? `aucun des ${p.total} indicateur(s) n'est encore mesurable` : `sur ${p.measured} indicateur(s) mesuré(s) sur ${p.total}`;
  if (p.basis === "actions") return `sur ${p.measured}/${p.total} action(s) terminée(s)`;
  return "aucune donnée pour la calculer";
}

function humanizeChanges(changes: any): string {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes as Record<string, { from: unknown; to: unknown }>)
    .map(([k, v]) => {
      const key = k.replace(/_/g, " ").replace(/\./g, " · ");
      const from = v?.from === null || v?.from === undefined || v?.from === "" ? null : String(v.from);
      const to = v?.to === null || v?.to === undefined || v?.to === "" ? null : String(v.to);
      if (from && to) return `${key} : ${from} → ${to}`;
      if (to) return `${key} : ${to}`;
      if (from) return `${key} : ${from} retiré`;
      return key;
    })
    .join(" ; ");
}

// Fiche de pilotage d'un objectif (groupe ou établissement) : tout ce qui permet de le piloter, sans changer de section.
export async function ObjectiveSheet({ cycleId, ownerType, ownerId, basePath, backHref }: { cycleId: string; ownerType: "groupe" | "etablissement"; ownerId: string; basePath: string; backHref: string }) {
  const detail = await loadObjectiveDetail(cycleId);
  if (!detail || detail.cycle.strategicGoal.ownerType !== ownerType || detail.cycle.strategicGoal.ownerId !== ownerId) notFound();
  const { cycle } = detail;
  const inherited = !!cycle.parentCycleId;

  let groupId = ownerId;
  let establishmentCount = 0;
  if (ownerType === "etablissement") {
    const est = await prisma.establishment.findUnique({ where: { id: ownerId }, select: { groupId: true } });
    groupId = est?.groupId || "";
  } else {
    establishmentCount = await prisma.establishment.count({ where: { groupId: ownerId } });
  }
  const parent = inherited
    ? await prisma.strategicGoalCycle.findUnique({ where: { id: cycle.parentCycleId as string }, include: { strategicGoal: { select: { ownerId: true } } } })
    : null;

  const scope = { ownerType, ownerId };
  const [actors, candidates, docCandidates, initCandidates, history] = await Promise.all([
    prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
    loadLinkCandidates(scope, {
      risks: detail.risks.map((r) => r.id),
      decisions: detail.decisions.map((d) => d.id),
      findings: detail.findings.map((f) => f.id),
      requirements: detail.requirements.map((q) => q.id),
    }),
    loadDocumentCandidates(scope),
    groupId ? loadInitiativeCandidates(groupId, cycle.contributions.map((c) => c.initiativeId)) : Promise.resolve([]),
    loadObjectiveHistory(cycle.id, cycle.actions.map((a) => a.id)),
  ]);

  const indicators: IndicatorView[] = detail.indicators.map((i) => ({
    id: i.id,
    nom: i.nom,
    description: i.description,
    unite: i.unite,
    sens: i.sens,
    valeurInitiale: i.valeurInitiale,
    valeurCible: i.valeurCible,
    actuelle: i.actuelle,
    progress: i.progress,
    frequence: i.frequence,
    echeance: i.echeance ? new Date(i.echeance).toISOString() : null,
    responsable: i.responsable,
    statut: i.statut,
    principal: i.principal,
    inherited: !!i.parentIndicatorId,
    cibleHeritee: i.cibleHeritee,
    cibleLocale: i.cibleLocale,
    measures: i.measures.map((m) => ({ id: m.id, valeur: m.valeur, dateMesure: new Date(m.dateMesure).toISOString(), commentaire: m.commentaire })),
  }));
  const principal = indicators.find((i) => i.principal) || indicators[0] || null;
  const cibleLabel = formatTarget(principal);
  const actionViews = cycle.actions.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    priority: a.priority,
    echeance: a.echeance ? a.echeance.toISOString() : null,
    responsable: a.responsable,
    livrable: a.livrable,
    indicatorName: indicators.find((i) => i.id === a.indicatorId)?.nom || null,
    origine: a.origine,
  }));
  const linkOf = (pred: (l: (typeof cycle.links)[number]) => string | null) => Object.fromEntries(cycle.links.map((l) => [pred(l) || "", l.id]));
  const riskLink = linkOf((l) => l.riskId);
  const decisionLink = linkOf((l) => l.decisionId);
  const findingLink = linkOf((l) => l.auditFindingId);
  const reqLink = linkOf((l) => l.qualityRequirementId);

  return (
    <div className="max-w-4xl">
      <Link href={backHref} className="text-sm text-blue hover:underline">
        ← Objectifs & conformité
      </Link>

      {/* En-tête */}
      <div className="mt-3 mb-6">
        <div className="text-xs text-muted mb-1">{cycle.strategicPlan.libelle}</div>
        <h1 className="font-display text-2xl text-ink uppercase tracking-wide">{cycle.strategicGoal.libelle}</h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Pill text={STATUT_LABEL[cycle.statut] || cycle.statut} tone={STATUT_TONE[cycle.statut] || "neutral"} />
          <Pill text={`Priorité ${cycle.priorite}`} tone={PRIORITE_TONE[cycle.priorite] || "neutral"} />
          {inherited && <Pill text="Hérité du groupe" tone="neutral" />}
          {cycle.diffusion !== "aucune" && !inherited && <Pill text="Diffusé aux établissements" tone="ok" />}
          {cycle.responsable && <span className="text-sm text-muted">Pilote : {cycle.responsable}</span>}
        </div>
        <div className="mt-4 flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-3xl font-display text-ink">{formatProgress(detail.progress)}</div>
            <div className="text-xs text-muted">Progression — {basisText(detail.progress)}</div>
          </div>
          {cibleLabel && (
            <div>
              <div className="text-lg text-ink">{cibleLabel}</div>
              <div className="text-xs text-muted">Cible · {principal?.nom}</div>
            </div>
          )}
          {detail.rollup && (
            <div>
              <div className="text-lg text-ink">{formatProgress(detail.rollup)}</div>
              <div className="text-xs text-muted">Établissements : {detail.rollup.measured}/{detail.rollup.total} mesuré(s)</div>
            </div>
          )}
        </div>
        <div className="mt-4">
          <ObjectiveHeaderControls
            cycleId={cycle.id}
            inherited={inherited}
            actors={actors}
            value={{
              libelle: cycle.strategicGoal.libelle,
              description: cycle.strategicGoal.description,
              statut: cycle.statut,
              priorite: cycle.priorite,
              axe: cycle.axe,
              resultatAttendu: cycle.resultatAttendu,
              perimetre: cycle.perimetre,
              echeance: cycle.echeance ? cycle.echeance.toISOString() : null,
              responsableActorId: cycle.responsableActorId,
            }}
          />
        </div>
      </div>

      <section className="mb-8">
        <SectionTitle>Description / finalité</SectionTitle>
        <div className="card text-sm text-body whitespace-pre-line">{cycle.strategicGoal.description || <span className="text-muted">Aucune description.</span>}</div>
      </section>

      <section className="mb-8">
        <SectionTitle>Résultat attendu</SectionTitle>
        <div className="card text-sm space-y-2">
          <div className="text-body whitespace-pre-line">{cycle.resultatAttendu || <span className="text-muted">Non renseigné.</span>}</div>
          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-ink/5">
            <div>
              <div className="label">Périmètre / population</div>
              {cycle.perimetre || <span className="text-muted">—</span>}
            </div>
            <div>
              <div className="label">Échéance</div>
              {cycle.echeance ? cycle.echeance.toLocaleDateString("fr-FR") : <span className="text-muted">—</span>}
            </div>
            <div>
              <div className="label">Axe stratégique</div>
              {cycle.axe || <span className="text-muted">—</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle sub="Comment on mesure le résultat : valeur initiale → mesures → cible.">Cibles & indicateurs</SectionTitle>
        <IndicatorsSection cycleId={cycle.id} indicators={indicators} legacyText={cycle.indicateurs} />
      </section>

      <section className="mb-8">
        <SectionTitle sub="Ce que l'on fait pour atteindre l'objectif — à compléter à tout moment.">Actions</SectionTitle>
        <ObjectiveActionsSection cycleId={cycle.id} ownerType={ownerType} ownerId={ownerId} actions={actionViews} indicators={indicators.map((i) => ({ id: i.id, nom: i.nom }))} actors={actors} />
      </section>

      <section className="mb-8">
        <SectionTitle sub="Projets qui contribuent à l'objectif.">Initiatives contributrices</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="initiative"
          items={cycle.contributions.map((c) => ({ key: c.id, label: c.initiative.name, sub: `${c.initiative.reference || ""} ${c.niveau}`.trim(), href: `/initiatives/${c.initiative.id}` }))}
          candidates={initCandidates}
          emptyText="Aucune initiative n'est associée à cet objectif."
          addLabel="+ Associer une initiative"
          noCandidatesText="Toutes les initiatives du groupe contribuent déjà à cet objectif (ou aucune n'existe)."
        />
      </section>

      <section className="mb-8">
        <SectionTitle>Établissements concernés</SectionTitle>
        {ownerType === "groupe" ? (
          detail.children.length === 0 ? (
            <div className="card space-y-3">
              <p className="text-sm text-muted">Cet objectif n'est pas diffusé aux établissements.</p>
              {!inherited && <DiffuseObjectiveButton cycleId={cycle.id} establishmentCount={establishmentCount} />}
            </div>
          ) : (
            <ul className="card !p-0 divide-y divide-ink/5">
              {detail.children.map((c) => (
                <li key={c.cycleId} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span>
                    {c.establishment ? (
                      <Link href={`/establishments/${c.establishment.id}/objectifs/${c.cycleId}`} className="text-blue hover:underline">
                        {c.establishment.name}
                      </Link>
                    ) : (
                      "Établissement"
                    )}
                    <span className="text-xs text-muted"> · {STATUT_LABEL[c.statut] || c.statut}</span>
                  </span>
                  <span className="text-muted">
                    {formatProgress(c.progress)} <span className="text-xs">({basisText(c.progress)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="card text-sm">
            {parent ? (
              <>
                Déclinaison locale de l'objectif du groupe —{" "}
                <Link href={`/groups/${parent.strategicGoal.ownerId}/objectifs/${parent.id}`} className="text-blue hover:underline">
                  voir l'objectif du groupe
                </Link>
                . L'intitulé est verrouillé ; vous renseignez vos valeurs, mesures, cible locale et actions.
              </>
            ) : (
              <span className="text-muted">Objectif propre à cet établissement.</span>
            )}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionTitle sub="Ce qui doit être respecté.">Exigences qualité & conformité</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="exigence"
          items={detail.requirements.map((q) => ({ key: reqLink[q.id], label: `${q.code ? q.code + " · " : ""}${q.libelle}`, sub: q.referentiel || undefined }))}
          candidates={candidates.exigences}
          emptyText="Aucune exigence associée."
          addLabel="+ Associer une exigence"
          noCandidatesText="Aucune exigence disponible dans ce périmètre (ou toutes sont déjà associées)."
        />
      </section>

      <section className="mb-8">
        <SectionTitle sub="Ce qui peut empêcher l'atteinte de l'objectif.">Risques associés</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="risque"
          items={detail.risks.map((r) => ({ key: riskLink[r.id], label: r.description, sub: `criticité ${r.criticite}` }))}
          candidates={candidates.risques}
          emptyText="Aucun risque associé."
          addLabel="+ Associer un risque"
          noCandidatesText="Aucun risque disponible dans ce périmètre (ou tous sont déjà associés)."
        />
      </section>

      <section className="mb-8">
        <SectionTitle sub="Ce qui permet de vérifier la conformité ou d'identifier un écart.">Constats d'audit</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="constat"
          items={detail.findings.map((f) => ({ key: findingLink[f.id], label: f.libelle, sub: `${f.type} · ${f.statut}` }))}
          candidates={candidates.constats}
          emptyText="Aucun constat associé."
          addLabel="+ Associer un constat"
          noCandidatesText="Aucun constat disponible dans ce périmètre (ou tous sont déjà associés)."
        />
      </section>

      <section className="mb-8">
        <SectionTitle>Décisions</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="decision"
          items={detail.decisions.map((d) => ({ key: decisionLink[d.id], label: d.subject, sub: d.status }))}
          candidates={candidates.decisions}
          emptyText="Aucune décision associée."
          addLabel="+ Associer une décision"
          noCandidatesText="Aucune décision disponible dans ce périmètre (ou toutes sont déjà associées)."
        />
      </section>

      <section className="mb-8">
        <SectionTitle sub="Ce qui permet de démontrer la réalisation ou la conformité.">Documents / preuves</SectionTitle>
        <AssociationSection
          cycleId={cycle.id}
          mode="document"
          items={detail.documents.map((d) => ({
            key: d.id,
            label: d.title,
            sub: d.linkedType === "objectif" ? "preuve de l'objectif" : `lié : ${d.linkedType}`,
            href: d.fileUrl || undefined,
            removable: d.linkedType === "objectif",
          }))}
          candidates={docCandidates}
          emptyText="Aucun document associé."
          addLabel="+ Associer un document"
          noCandidatesText="Aucun document libre dans ce périmètre : déposez-le d'abord dans les documents du groupe ou de l'établissement."
        />
      </section>

      <section className="mb-12">
        <SectionTitle>Historique</SectionTitle>
        {history.length === 0 ? (
          <div className="card text-sm text-muted">Aucun événement enregistré.</div>
        ) : (
          <ul className="card !p-0 divide-y divide-ink/5">
            {history.map((h) => (
              <li key={h.id} className="px-4 py-2.5 text-sm">
                <div className="text-xs text-muted">
                  {h.createdAt.toLocaleString("fr-FR")} · {h.userName}
                  {h.entityType === "action" ? " · action" : ""}
                </div>
                <div className="text-body">
                  {h.action === "create" ? (h.entityType === "action" ? `Action créée : ${h.entityLabel}` : "Objectif créé") : humanizeChanges(h.changes) || (h.entityType === "action" ? `Action modifiée : ${h.entityLabel}` : "Modification")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
