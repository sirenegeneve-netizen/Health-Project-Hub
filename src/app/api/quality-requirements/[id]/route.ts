import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const updated = await prisma.qualityRequirement.update({
    where: { id: params.id },
    data: {
      referentiel: body.referentiel,
      code: body.code,
      libelle: body.libelle,
      description: body.description,
      applicable: typeof body.applicable === "boolean" ? body.applicable : undefined,
    },
  });
  return NextResponse.json(updated);
}
