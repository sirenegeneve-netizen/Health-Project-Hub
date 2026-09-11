import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Permet de surcharger la phase d'un établissement précis dans un projet
// multi-sites (vue comparative) — envoyer phase: "" retire la surcharge et
// fait retomber l'affichage sur la phase globale du projet.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = await prisma.initiativeEstablishment.update({
    where: { id: params.id },
    data: { phase: body.phase || null },
  });
  return NextResponse.json(updated);
}
