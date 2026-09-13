import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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
  return NextResponse.json({ ok: true });
}
