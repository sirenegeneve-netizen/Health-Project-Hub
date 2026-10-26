import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";
import { changeState } from "@/lib/declinaisonDb";

const ACTIONS = ["prendre_en_charge", "annuler_prise_en_charge", "demarrer", "terminer", "rouvrir"];

// État de prise en charge d'une DÉCLINAISON d'établissement. Corps : { action }. Déclaré par l'établissement (jamais déduit des actions).
// Le droit « modifier » sur la déclinaison est requis : un rôle de groupe consulte sans modifier les données locales.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("strategicGoalCycle", params.id, "modifier");
  if (!__g.ok) return __g.response;

  const body: any = await req.json().catch(() => ({}));
  if (!body || !ACTIONS.includes(body.action)) return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  const res = await changeState(params.id, body.action, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
  return NextResponse.json({ ok: true, ...res.data });
}
