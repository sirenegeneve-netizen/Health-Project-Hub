import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Renvoie le guide méthodologique + les éléments typiques (risques/livrables/
// indicateurs) pour un type d'initiative. Utilisé par le formulaire de création
// (suggestions à la volée) et par la page /initiatives/[id]/methode.
// Si rien n'a encore été seedé (npm run db:seed-methodology), renvoie null plutôt
// que d'échouer — l'écran appelant doit gérer ce cas sans casser.
export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const guide = await prisma.methodologyGuide.findUnique({
    where: { initiativeType: params.type },
    include: { items: { orderBy: { ordre: "asc" } }, relatedTypes: { orderBy: { ordre: "asc" } } },
  });
  return NextResponse.json(guide);
}
