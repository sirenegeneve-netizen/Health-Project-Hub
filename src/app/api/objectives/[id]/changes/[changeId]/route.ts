import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";
import { reviewChange } from "@/lib/declinaisonDb";

// Décision d'une DÉCLINAISON sur un changement de l'objectif du groupe. Corps : { decision: "accepte" | "ignore" }.
// « accepte » recopie seulement les champs non propagés automatiquement ; « ignore » conserve le local. Jamais touchés : cible locale,
// indicateurs locaux, responsable, statut. Décision historisée, non modifiable.
export async function POST(req: NextRequest, { params }: { params: { id: string; changeId: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("strategicGoalCycle", params.id, "modifier");
  if (!__g.ok) return __g.response;

  const body: any = await req.json().catch(() => ({}));
  const res = await reviewChange(params.id, params.changeId, body && body.decision, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
  return NextResponse.json({ ok: true, ...res.data });
}
