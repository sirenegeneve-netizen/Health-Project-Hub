import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const point = await prisma.vigilancePoint.findUniqueOrThrow({ where: { id: params.id } });

  if (body.requalifyAs) {
    const type = body.requalifyAs as "action" | "risque" | "decision" | "evolution";
    if (type === "action") {
      await prisma.action.create({ data: { projectId: point.projectId, title: point.description, origine: "vigilance" } });
    } else if (type === "risque") {
      await prisma.risk.create({ data: { projectId: point.projectId, description: point.description } });
    } else if (type === "decision") {
      await prisma.decision.create({ data: { projectId: point.projectId, subject: point.description } });
    } else if (type === "evolution") {
      await prisma.backlogItem.create({ data: { projectId: point.projectId, demande: point.description, origine: "vigilance" } });
    }
    await logTimelineEvent(point.projectId, "vigilance", `Point de vigilance requalifié en ${type} : « ${point.description} »`);
    const updated = await prisma.vigilancePoint.update({
      where: { id: params.id },
      data: { status: "requalifie", convertedTo: type },
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.vigilancePoint.update({
    where: { id: params.id },
    data: { status: body.status ?? undefined, description: body.description ?? undefined },
  });
  return NextResponse.json(updated);
}
