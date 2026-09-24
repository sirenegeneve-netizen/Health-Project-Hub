import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit, truncateLabel } from "@/lib/audit";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const doc = await prisma.documentRef.findUnique({ where: { id: params.id } });
  if (doc?.fileUrl) {
    try {
      await del(doc.fileUrl);
    } catch {
      // Le fichier Blob a pu déjà être supprimé indépendamment — on continue,
      // la suppression de la référence en base reste l'action prioritaire.
    }
  }
  await prisma.documentRef.delete({ where: { id: params.id } });
  if (doc) {
    await logAudit({ entityType: "document", entityId: params.id, entityLabel: truncateLabel(doc.title), action: "delete", user });
  }
  return NextResponse.json({ ok: true });
}
