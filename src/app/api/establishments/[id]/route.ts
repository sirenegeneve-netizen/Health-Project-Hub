import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const before = await prisma.establishment.findUnique({ where: { id: params.id } });
  const body = await req.json();
  const establishment = await prisma.establishment.update({
    where: { id: params.id },
    data: {
      name: body.name || undefined,
      type: body.type ?? undefined,
      localisation: body.localisation ?? undefined,
      status: body.status ?? undefined,
      adresse: body.adresse ?? undefined,
      ville: body.ville ?? undefined,
      pays: body.pays ?? undefined,
      siteWeb: body.siteWeb ?? undefined,
      activite: body.activite ?? undefined,
      nombreLits: body.nombreLits !== undefined ? (body.nombreLits === "" ? null : Number(body.nombreLits)) : undefined,
      nombrePlaces: body.nombrePlaces !== undefined ? (body.nombrePlaces === "" ? null : Number(body.nombrePlaces)) : undefined,
      nombreUtilisateurs: body.nombreUtilisateurs !== undefined ? (body.nombreUtilisateurs === "" ? null : Number(body.nombreUtilisateurs)) : undefined,
      dateSignature: body.dateSignature !== undefined ? (body.dateSignature ? new Date(body.dateSignature) : null) : undefined,
      dateDemarrage: body.dateDemarrage !== undefined ? (body.dateDemarrage ? new Date(body.dateDemarrage) : null) : undefined,
      dateFin: body.dateFin !== undefined ? (body.dateFin ? new Date(body.dateFin) : null) : undefined,
      montantAnnuel: body.montantAnnuel !== undefined ? (body.montantAnnuel === "" ? null : Number(body.montantAnnuel)) : undefined,
      maintenance: body.maintenance ?? undefined,
      support: body.support ?? undefined,
    },
  });
  if (before) {
    await logAudit({ entityType: "establishment", entityId: establishment.id, entityLabel: establishment.name, action: "update", changes: diffRecords(before, establishment), user });
  }
  return NextResponse.json(establishment);
}
