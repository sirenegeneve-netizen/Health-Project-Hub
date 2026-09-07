import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.interface.findUniqueOrThrow({ where: { id: params.id } });

  const iface = await prisma.interface.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      systemeSource: body.systemeSource ?? undefined,
      systemeCible: body.systemeCible ?? undefined,
      flux: body.flux ?? undefined,
      protocole: body.protocole ?? undefined,
      standard: body.standard ?? undefined,
      responsable: body.responsable ?? undefined,
      fournisseur: body.fournisseur ?? undefined,
      status: body.status ?? undefined,
      datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
      dateReelle: body.dateReelle !== undefined ? (body.dateReelle ? new Date(body.dateReelle) : null) : undefined,
      dateTest: body.dateTest !== undefined ? (body.dateTest ? new Date(body.dateTest) : null) : undefined,
      resultat: body.resultat ?? undefined,
      isBlocking: body.isBlocking !== undefined ? !!body.isBlocking : undefined,
    },
  });

  // §13 : une interface qui devient bloquante doit remonter automatiquement
  // (ici : timeline + le calcul du health score la détecte à la volée).
  const becameBlocking = iface.isBlocking && !before.isBlocking;
  if (becameBlocking) {
    await logTimelineEvent(iface.projectId, "interface", `⚠ Interface « ${iface.name} » devenue bloquante`);
  } else if (body.status && body.status !== before.status) {
    await logTimelineEvent(iface.projectId, "interface", `Interface « ${iface.name} » → ${body.status}`);
  }

  return NextResponse.json(iface);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.interface.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
