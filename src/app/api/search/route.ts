import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  const contains = { contains: q };

  const [initiatives, actions, risks, decisions, interfaces, anomalies, meetings, documents, vigilancePoints] =
    await Promise.all([
      prisma.initiative.findMany({ where: { OR: [{ name: contains }, { reference: contains }, { description: contains }] } }),
      prisma.action.findMany({ where: { OR: [{ title: contains }, { comments: contains }] }, include: { initiative: true } }),
      prisma.risk.findMany({ where: { OR: [{ description: contains }, { cause: contains }] }, include: { initiative: true } }),
      prisma.decision.findMany({ where: { OR: [{ subject: contains }, { context: contains }] }, include: { initiative: true } }),
      prisma.interface.findMany({ where: { OR: [{ name: contains }, { systemeSource: contains }, { systemeCible: contains }] }, include: { initiative: true } }),
      prisma.anomaly.findMany({ where: { description: contains }, include: { initiative: true } }),
      prisma.meeting.findMany({ where: { OR: [{ title: contains }, { notes: contains }] }, include: { initiative: true } }),
      prisma.documentRef.findMany({ where: { OR: [{ title: contains }, { note: contains }] }, include: { initiative: true } }),
      prisma.vigilancePoint.findMany({ where: { description: contains }, include: { initiative: true } }),
    ]);

  const results = [
    ...initiatives.map((p) => ({ kind: "Projet", label: p.name, href: `/initiatives/${p.id}` })),
    ...actions.map((a) => ({ kind: "Action", label: a.title, href: `/initiatives/${a.initiativeId}/actions` })),
    ...risks.map((r) => ({ kind: "Risque", label: r.description, href: `/initiatives/${r.initiativeId}/risks` })),
    ...decisions.map((d) => ({ kind: "Décision", label: d.subject, href: `/initiatives/${d.initiativeId}/decisions` })),
    ...interfaces.map((i) => ({ kind: "Interface", label: i.name, href: `/initiatives/${i.initiativeId}/interfaces` })),
    ...anomalies.map((a) => ({ kind: "Anomalie", label: a.description, href: `/initiatives/${a.initiativeId}` })),
    ...meetings.map((m) => ({ kind: "Réunion", label: m.title, href: `/initiatives/${m.initiativeId}/meetings/${m.id}` })),
    ...documents.map((d) => ({ kind: "Document", label: d.title, href: `/initiatives/${d.initiativeId}` })),
    ...vigilancePoints.map((v) => ({ kind: "Point de vigilance", label: v.description, href: `/initiatives/${v.initiativeId}` })),
  ];

  return NextResponse.json({ results });
}
