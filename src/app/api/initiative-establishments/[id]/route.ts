import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

// Permet de surcharger la phase d'un établissement précis dans un projet
// multi-sites (vue comparative) — envoyer phase: "" retire la surcharge et
// fait retomber l'affichage sur la phase globale du projet.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("initiativeEstablishment", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

  const updated = await prisma.initiativeEstablishment.update({
    where: { id: params.id },
    data: { phase: body.phase || null },
  });
  return NextResponse.json(updated);
}

// Retire le rattachement d'un établissement à l'initiative (ne supprime pas
// l'établissement lui-même, juste le lien many-to-many pour cette initiative).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("initiativeEstablishment", params.id, "supprimer");
  if (!__g.ok) return __g.response;


  await prisma.initiativeEstablishment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
