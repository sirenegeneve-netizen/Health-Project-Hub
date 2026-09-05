import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const point = await prisma.vigilancePoint.create({
    data: { projectId: body.projectId, description: body.description },
  });
  await logTimelineEvent(body.projectId, "vigilance", `Point de vigilance : « ${point.description} »`);
  return NextResponse.json(point, { status: 201 });
}
