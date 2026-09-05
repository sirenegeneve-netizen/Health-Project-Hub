import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  const contains = { contains: q };

  const [projects, actions, risks, decisions, interfaces, anomalies, meetings, documents, vigilancePoints] =
    await Promise.all([
      prisma.project.findMany({ where: { OR: [{ name: contains }, { reference: contains }, { description: contains }] } }),
      prisma.action.findMany({ where: { OR: [{ title: contains }, { comments: contains }] }, include: { project: true } }),
      prisma.risk.findMany({ where: { OR: [{ description: contains }, { cause: contains }] }, include: { project: true } }),
      prisma.decision.findMany({ where: { OR: [{ subject: contains }, { context: contains }] }, include: { project: true } }),
      prisma.interface.findMany({ where: { OR: [{ name: contains }, { systemeSource: contains }, { systemeCible: contains }] }, include: { project: true } }),
      prisma.anomaly.findMany({ where: { description: contains }, include: { project: true } }),
      prisma.meeting.findMany({ where: { OR: [{ title: contains }, { notes: contains }] }, include: { project: true } }),
      prisma.documentRef.findMany({ where: { OR: [{ title: contains }, { note: contains }] }, include: { project: true } }),
      prisma.vigilancePoint.findMany({ where: { description: contains }, include: { project: true } }),
    ]);

  const results = [
    ...projects.map((p) => ({ kind: "Projet", label: p.name, href: `/projects/${p.id}` })),
    ...actions.map((a) => ({ kind: "Action", label: a.title, href: `/projects/${a.projectId}/actions` })),
    ...risks.map((r) => ({ kind: "Risque", label: r.description, href: `/projects/${r.projectId}/risks` })),
    ...decisions.map((d) => ({ kind: "Décision", label: d.subject, href: `/projects/${d.projectId}/decisions` })),
    ...interfaces.map((i) => ({ kind: "Interface", label: i.name, href: `/projects/${i.projectId}/interfaces` })),
    ...anomalies.map((a) => ({ kind: "Anomalie", label: a.description, href: `/projects/${a.projectId}` })),
    ...meetings.map((m) => ({ kind: "Réunion", label: m.title, href: `/projects/${m.projectId}/meetings/${m.id}` })),
    ...documents.map((d) => ({ kind: "Document", label: d.title, href: `/projects/${d.projectId}` })),
    ...vigilancePoints.map((v) => ({ kind: "Point de vigilance", label: v.description, href: `/projects/${v.projectId}` })),
  ];

  return NextResponse.json({ results });
}
