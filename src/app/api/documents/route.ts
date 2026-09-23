import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { analyzeText } from "@/lib/mailSuggest";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const initiativeId = req.nextUrl.searchParams.get("initiativeId");
  if (!initiativeId) return NextResponse.json({ error: "initiativeId requis" }, { status: 400 });
  const docs = await prisma.documentRef.findMany({ where: { initiativeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();

  const ownerType = body.ownerType || "initiative"; // groupe | etablissement | initiative
  const ownerId = body.ownerId || body.initiativeId;
  const initiativeId = ownerType === "initiative" ? body.initiativeId : null;
  if (!ownerId) return NextResponse.json({ error: "Portée (ownerId) requise." }, { status: 400 });

  const doc = await prisma.documentRef.create({
    data: {
      initiativeId,
      ownerType,
      ownerId,
      title: body.title,
      type: body.type || "mail",
      note: body.note || null,
    },
  });
  if (initiativeId) {
    await logTimelineEvent(initiativeId, "document", `Document importé : « ${doc.title} »`);
  }

  let suggestions = null;
  if (body.note && initiativeId) {
    const interfaces = await prisma.interface.findMany({ where: { initiativeId }, select: { name: true } });
    suggestions = analyzeText(body.note, interfaces.map((i) => i.name));
  }

  return NextResponse.json({ document: doc, suggestions }, { status: 201 });
}
