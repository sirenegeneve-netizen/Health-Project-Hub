import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCorrectiveAction } from "@/lib/baselineAuditDb";
import { guardRecord } from "@/lib/access";

// Crée (ou retrouve) l'action corrective d'un constat d'audit de départ — une seule action de traitement par constat.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const __g = await guardRecord("auditFinding", params.id, "modifier");
  if (!__g.ok) return __g.response;

  const res = await createCorrectiveAction(params.id, body, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data!, { status: res.data!.created ? 201 : 200 });
}
