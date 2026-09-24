import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, truncateLabel } from "@/lib/audit";

// Upload d'un vrai fichier (PDF, Word, image...) vers Vercel Blob — distinct de
// la route /api/documents qui gère l'import de texte collé (mail, compte rendu).
// Nécessite qu'un store Blob soit connecté au projet Vercel (Storage → Create
// Database → Blob) ; la variable BLOB_READ_WRITE_TOKEN est alors injectée
// automatiquement, rien à configurer à la main.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Aucun store Vercel Blob connecté à ce projet Vercel. Ajoutez-en un depuis l'onglet Storage de votre projet Vercel." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const initiativeIdRaw = formData.get("initiativeId") as string | null;
  const ownerType = (formData.get("ownerType") as string | null) || "initiative"; // groupe | etablissement | initiative
  const ownerIdRaw = (formData.get("ownerId") as string | null) || initiativeIdRaw;
  const title = (formData.get("title") as string | null) || file?.name || "Document";
  const type = (formData.get("type") as string | null) || "autre";

  const initiativeId = ownerType === "initiative" ? initiativeIdRaw : null;

  if (!file || !ownerIdRaw) {
    return NextResponse.json({ error: "Fichier et portée (ownerId) requis." }, { status: 400 });
  }

  const blob = await put(file.name, file, { access: "public", addRandomSuffix: true });

  const doc = await prisma.documentRef.create({
    data: {
      initiativeId,
      ownerType,
      ownerId: ownerIdRaw,
      title,
      type,
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || null,
    },
  });

  if (initiativeId) {
    await logTimelineEvent(initiativeId, "document", `Fichier importé : « ${doc.title} »`);
  }
  await logAudit({ entityType: "document", entityId: doc.id, entityLabel: truncateLabel(doc.title), action: "create", user });

  return NextResponse.json(doc, { status: 201 });
}
