import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.deliverable.create({
    data: {
      projectId: body.projectId,
      name: body.name,
      description: body.description || null,
      responsable: body.responsable || null,
      datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
      version: body.version || null,
    },
  });
  await logTimelineEvent(body.projectId, "livrable", `Livrable ajouté : « ${item.name} »`);
  return NextResponse.json(item, { status: 201 });
}
