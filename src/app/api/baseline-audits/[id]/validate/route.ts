import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { validateAudit } from "@/lib/baselineAuditDb";
import { guardRecord } from "@/lib/access";

// Valide l'audit enregistré : met à jour la valeur initiale (mesures « valeur mesurée » uniquement) et crée les constats.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("baselineAudit", params.id, "valider");
  if (!__g.ok) return __g.response;

  const res = await validateAudit(params.id, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error, errors: res.errors }, { status: res.status });
  return NextResponse.json(res.data!);
}
