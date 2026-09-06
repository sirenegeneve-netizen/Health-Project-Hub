import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { VigilanceForm, BacklogForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const events = await prisma.timelineEvent.findMany({ where: { projectId: params.id }, orderBy: { date: "desc" } });
  const vigilancePoints = await prisma.vigilancePoint.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });
  const backlogItems = await prisma.backlogItem.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });
  const documents = await prisma.documentRef.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  const grouped = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Date(e.date).toLocaleDateString("fr-FR");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-1">Mémoire du projet</h1>
      <p className="text-ink/60 mb-6">Chaque événement significatif s'ajoute ici automatiquement — rien n'est saisi deux fois.</p>

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([date, items]) => (
          <div key={date}>
            <div className="text-sm font-medium text-ink mb-2">{date}</div>
            <div className="card space-y-2">
              {items.map((e) => (
                <div key={e.id} className="flex gap-3 text-sm">
                  <span className="text-ink/40 w-24 shrink-0 capitalize">{e.type}</span>
                  <span>{e.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="card text-center text-ink/50">Aucun événement pour le moment.</div>}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div>
          <h2 className="font-display text-xl text-ink mb-3">Points de vigilance</h2>
          <VigilanceForm projectId={params.id} />
          <div className="card space-y-2">
            {vigilancePoints.map((v) => (
              <div key={v.id} className="text-sm border-b border-teal-50 last:border-0 pb-2 last:pb-0">
                <div>{v.description}</div>
                <div className="text-xs text-ink/50">
                  {v.status === "requalifie" ? `requalifié en ${v.convertedTo}` : "à surveiller"}
                </div>
              </div>
            ))}
            {vigilancePoints.length === 0 && <div className="text-ink/50 text-sm">Aucun point de vigilance.</div>}
          </div>

          <h2 className="font-display text-xl text-ink mb-3 mt-8">Backlog / amélioration continue</h2>
          <BacklogForm projectId={params.id} />
          <div className="card space-y-2">
            {backlogItems.map((b) => (
              <div key={b.id} className="text-sm border-b border-teal-50 last:border-0 pb-2 last:pb-0">
                <div className="font-medium">{b.demande}</div>
                <div className="text-xs text-ink/50">{b.priorite} {b.estimationJh ? `· ${b.estimationJh} JH est.` : ""}</div>
              </div>
            ))}
            {backlogItems.length === 0 && <div className="text-ink/50 text-sm">Backlog vide.</div>}
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink mb-3">Documents & échanges</h2>
          <p className="text-sm text-ink/60 mb-3">
            Importez un compte rendu, une spécification ou le texte d'un mail : le système propose une action ou un
            risque si un retard est détecté, mais ne crée jamais rien sans validation (§34).
          </p>
          <div className="card space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="text-sm border-b border-teal-50 last:border-0 pb-2 last:pb-0">
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-ink/50">{d.type}</div>
              </div>
            ))}
            {documents.length === 0 && <div className="text-ink/50 text-sm">Aucun document importé.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
