import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { validateObjectiveInput } from "@/lib/objectifs";
import { createObjective, summarizeObjectives } from "@/lib/objectifsDb";

// Liste de pilotage : objectifs d'un groupe ou d'un établissement avec cible, compteurs et progression
// calculée (« — » tant qu'aucune donnée réelle ne permet de la calculer).
export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const ownerType = sp.get("ownerType");
  const ownerId = sp.get("ownerId");
  if (!ownerType || !ownerId || !["groupe", "etablissement"].includes(ownerType)) {
    return NextResponse.json({ error: "ownerType (groupe | etablissement) et ownerId requis." }, { status: 400 });
  }
  return NextResponse.json(await summarizeObjectives(ownerType, ownerId));
}

// Création complète d'un objectif en une transaction : identification, résultat attendu, indicateurs,
// premières actions (toutes facultatives) — sans étape « décliner dans un plan ».
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const errors = validateObjectiveInput(body);
  if (errors.length > 0) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

  const res = await createObjective(body);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });

  await logAudit({
    entityType: "objectif",
    entityId: res.id as string,
    entityLabel: String(body.libelle).trim().slice(0, 120),
    action: "create",
    user,
  });
  return NextResponse.json({ id: res.id }, { status: 201 });
}
