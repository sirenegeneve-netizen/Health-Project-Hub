import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const norm = (s: string | null) => (s || "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  const nom = req.nextUrl.searchParams.get("nom");
  if (!nom) return NextResponse.json({ items: [] });
  const n = norm(nom);
  const now = new Date();

  const [actions, decisions, deliverables, meetings] = await Promise.all([
    prisma.action.findMany({ include: { initiative: true } }),
    prisma.decision.findMany({ include: { initiative: true } }),
    prisma.deliverable.findMany({ include: { initiative: true } }),
    prisma.meeting.findMany({ where: { date: { gte: now } }, include: { initiative: true } }),
  ]);

  const items = [
    ...actions
      .filter((a) => norm(a.responsable) === n && !["termine", "abandonne"].includes(a.status))
      .map((a) => ({ kind: "Action", label: a.title, initiativeName: a.initiative.name, href: `/initiatives/${a.initiativeId}/actions`, date: a.echeance ? a.echeance.toISOString() : null })),
    ...decisions
      .filter((d) => norm(d.decideur) === n && d.status !== "decision_prise")
      .map((d) => ({ kind: "Décision", label: d.subject, initiativeName: d.initiative.name, href: `/initiatives/${d.initiativeId}/decisions`, date: null })),
    ...deliverables
      .filter((d) => norm(d.responsable) === n && d.status !== "valide")
      .map((d) => ({ kind: "Livrable", label: d.name, initiativeName: d.initiative.name, href: `/initiatives/${d.initiativeId}/conception`, date: d.datePrevue ? d.datePrevue.toISOString() : null })),
    ...meetings
      .filter((m) => norm(m.participants).includes(n))
      .map((m) => ({ kind: "Réunion", label: m.title, initiativeName: m.initiative.name, href: `/initiatives/${m.initiativeId}/meetings/${m.id}`, date: m.date.toISOString() })),
  ].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return NextResponse.json({ items });
}
