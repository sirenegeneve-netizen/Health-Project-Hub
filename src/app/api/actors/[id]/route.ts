import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const actor = await prisma.actor.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      actif: body.actif !== undefined ? Boolean(body.actif) : undefined,
      fonction: body.fonction ?? undefined,
      organisation: body.organisation ?? undefined,
      roleProjet: body.roleProjet ?? undefined,
      email: body.email ?? undefined,
      telephone: body.telephone ?? undefined,
      disponibiliteJh: body.disponibiliteJh !== undefined ? (body.disponibiliteJh ? Number(body.disponibiliteJh) : null) : undefined,
      competences: body.competences ?? undefined,
    },
  });
  return NextResponse.json(actor);
}

// Suppression physique volontairement désactivée : un Acteur est référencé par
// beaucoup d'historique (RACI, actions, risques, décisions, réunions, incidents,
// chefDeProjet/sponsor...). Utiliser PATCH { actif: false } pour désactiver un
// acteur — il disparaît des listes de sélection sans casser l'historique.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  return NextResponse.json(
    { error: "Suppression désactivée. Utilisez la désactivation (PATCH actif=false) pour retirer un acteur des listes de sélection sans perdre l'historique associé." },
    { status: 405 }
  );
}
