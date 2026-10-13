import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveAuditDraft } from "@/lib/baselineAuditDb";

// Enregistre (ou met à jour) le brouillon de l'audit de départ d'une action, pour un périmètre donné.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await saveAuditDraft(params.id, body, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error, errors: res.errors }, { status: res.status });
  return NextResponse.json(res.data!);
}
