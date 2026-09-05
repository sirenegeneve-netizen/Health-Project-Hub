import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { analyzeText } from "@/lib/mailSuggest";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId requis" }, { status: 400 });
  const docs = await prisma.documentRef.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const doc = await prisma.documentRef.create({
    data: {
      projectId: body.projectId,
      title: body.title,
      type: body.type || "mail",
      note: body.note || null,
    },
  });
  await logTimelineEvent(body.projectId, "document", `Document importé : « ${doc.title} »`);

  let suggestions = null;
  if (body.note) {
    const interfaces = await prisma.interface.findMany({ where: { projectId: body.projectId }, select: { name: true } });
    suggestions = analyzeText(body.note, interfaces.map((i) => i.name));
  }

  return NextResponse.json({ document: doc, suggestions }, { status: 201 });
}
