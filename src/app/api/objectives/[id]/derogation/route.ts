import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";
import { canDecideDerogation } from "@/lib/declinaison";
import { changeDerogation } from "@/lib/declinaisonDb";

const ESTABLISHMENT_ACTIONS = ["demander", "retirer"];
const GROUP_ACTIONS = ["valider", "refuser", "revoquer"];

// Dérogation d'une DÉCLINAISON. Corps : { action, motif?, note? }.
//  - demander (motif obligatoire) / retirer : par l'établissement (droit « modifier » sur la déclinaison) ;
//  - valider / refuser (note obligatoire) / revoquer : par le directeur ou l'administrateur du groupe — droit « valider » sur
//    l'objectif parent du groupe ET contrôle de rôle.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body: any = await req.json().catch(() => ({}));
  const action: string = body && body.action;
  const byGroup = GROUP_ACTIONS.includes(action);
  if (!byGroup && !ESTABLISHMENT_ACTIONS.includes(action)) return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const __g = await guardRecord("strategicGoalCycle", params.id, byGroup ? "voir" : "modifier");
  if (!__g.ok) return __g.response;

  if (byGroup) {
    const child = await prisma.strategicGoalCycle.findUnique({ where: { id: params.id }, select: { parentCycleId: true } });
    if (!child || !child.parentCycleId) return NextResponse.json({ error: "Déclinaison introuvable." }, { status: 404 });
    const parent = await prisma.strategicGoalCycle.findUnique({ where: { id: child.parentCycleId }, select: { strategicGoal: { select: { ownerId: true } } } });
    if (!parent) return NextResponse.json({ error: "Objectif du groupe introuvable." }, { status: 404 });
    const __p = await guardRecord("strategicGoalCycle", child.parentCycleId, "valider");
    if (!__p.ok) return __p.response;
    if (!canDecideDerogation(__p.access!.assignments, parent.strategicGoal.ownerId)) {
      return NextResponse.json({ error: "Seul le directeur ou l'administrateur du groupe peut décider d'une dérogation." }, { status: 403 });
    }
  }

  const res = await changeDerogation(params.id, action as any, { motif: body.motif, note: body.note }, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
  return NextResponse.json({ ok: true, ...res.data });
}
