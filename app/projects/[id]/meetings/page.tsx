import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { MeetingForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const meetings = await prisma.meeting.findMany({
    where: { projectId: params.id },
    orderBy: { date: "desc" },
    include: { _count: { select: { actions: true, risks: true, decisions: true } } },
  });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Réunions</h1>
      <MeetingForm projectId={params.id} />

      <div className="space-y-2">
        {meetings.map((m) => (
          <Link key={m.id} href={`/projects/${params.id}/meetings/${m.id}`} className="card flex items-center justify-between hover:bg-teal-50/30 block">
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
