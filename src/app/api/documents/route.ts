import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { analyzeText } from "@/lib/mailSuggest";

export async function GET(req: NextRequest) {
  const initiativeId = req.nextUrl.searchParams.get("initiativeId");
  if (!initiativeId) return NextResponse.json({ error: "initiativeId requis" }, { status: 400 });
  const docs = await prisma.documentRef.findMany({ where: { initiativeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const doc = await prisma.documentRef.create({
    data: {
      initiativeId: body.initiativeId,
      title: body.title,
      type: body.type || "mail",
      note: body.note || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "document", `Document importé : « ${doc.title} »`);

  let suggestions = null;
  if (body.note) {
    const interfaces = await prisma.interface.findMany({ where: { initiativeId: body.initiativeId }, select: { name: true } });
    suggestions = analyzeText(body.note, interfaces.map((i) => i.name));
  }

  return NextResponse.json({ document: doc, suggestions }, { status: 201 });
}
