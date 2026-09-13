import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

// Upload d'un vrai fichier (PDF, Word, image...) vers Vercel Blob — distinct de
// la route /api/documents qui gère l'import de texte collé (mail, compte rendu).
// Nécessite qu'un store Blob soit connecté au projet Vercel (Storage → Create
// Database → Blob) ; la variable BLOB_READ_WRITE_TOKEN est alors injectée
// automatiquement, rien à configurer à la main.
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Aucun store Vercel Blob connecté à ce projet. Ajoutez-en un depuis l'onglet Storage de votre projet Vercel." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const initiativeId = formData.get("initiativeId") as string | null;
  const title = (formData.get("title") as string | null) || file?.name || "Document";
  const type = (formData.get("type") as string | null) || "autre";

  if (!file || !initiativeId) {
    return NextResponse.json({ error: "Fichier et initiativeId requis." }, { status: 400 });
  }

  const blob = await put(file.name, file, { access: "public", addRandomSuffix: true });

  const doc = await prisma.documentRef.create({
    data: {
      initiativeId,
      title,
      type,
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || null,
    },
  });

  await logTimelineEvent(initiativeId, "document", `Fichier importé : « ${doc.title} »`);

  return NextResponse.json(doc, { status: 201 });
}
