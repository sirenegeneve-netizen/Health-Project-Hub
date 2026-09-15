import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { MeetingForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: params.id } });
  if (!initiative) notFound();
  const meetings = await prisma.meeting.findMany({
    where: { initiativeId: params.id },
    orderBy: { date: "desc" },
    include: { _count: { select: { actions: true, risks: true, decisions: true } } },
  });
  const actors = await findInitiativeActors(params.id, { id: true, name: true });

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Réunions</h1>
      <MeetingForm initiativeId={params.id} actors={actors} />

      <div className="space-y-2">
        {meetings.map((m) => (
          <Link key={m.id} href={`/initiatives/${params.id}/meetings/${m.id}`} className="card flex items-center justify-between hover:bg-teal-50/30 block">
            <div>
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-ink/50 capitalize">{m.type.replace(/_/g, " ")}</div>
            </div>
            <div className="text-sm text-ink/60 flex gap-4">
              <span>{new Date(m.date).toLocaleString("fr-FR")}</span>
              <span>{m._count.decisions} décision(s) · {m._count.actions} action(s) · {m._count.risks} risque(s)</span>
            </div>
          </Link>
        ))}
        {meetings.length === 0 && <div className="card text-center text-ink/50">Aucune réunion planifiée.</div>}
      </div>
    </div>
  );
}
