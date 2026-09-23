import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

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

  const ownerHref = (o: { ownerType: string; ownerId: string | null; initiativeId: string | null }, initiativeSuffix: string, initiativeFallback: string) => {
    if (o.ownerType === "groupe" && o.ownerId) return `/groups/${o.ownerId}/${initiativeFallback}`;
    if (o.ownerType === "etablissement" && o.ownerId) return `/establishments/${o.ownerId}/${initiativeFallback}`;
    return `/initiatives/${o.initiativeId}${initiativeSuffix}`;
  };

  const results = [
    ...initiatives.map((p) => ({ kind: "Initiative", label: p.name, href: `/initiatives/${p.id}` })),
    ...actions.map((a) => ({ kind: "Action", label: a.title, href: ownerHref(a, "/actions", "actions") })),
    ...risks.map((r) => ({ kind: "Risque", label: r.description, href: ownerHref(r, "/risks", "risques") })),
    ...decisions.map((d) => ({ kind: "Décision", label: d.subject, href: d.initiativeId ? `/initiatives/${d.initiativeId}/decisions` : "#" })),
    ...interfaces.map((i) => ({ kind: "Interface", label: i.name, href: `/initiatives/${i.initiativeId}/interfaces` })),
    ...anomalies.map((a) => ({ kind: "Anomalie", label: a.description, href: `/initiatives/${a.initiativeId}` })),
    ...meetings.map((m) => ({ kind: "Réunion", label: m.title, href: `/initiatives/${m.initiativeId}/meetings/${m.id}` })),
    ...documents.map((d) => ({ kind: "Document", label: d.title, href: ownerHref(d, "", "documents") })),
    ...vigilancePoints.map((v) => ({ kind: "Point de vigilance", label: v.description, href: `/initiatives/${v.initiativeId}` })),
  ];

  return NextResponse.json({ results });
}
