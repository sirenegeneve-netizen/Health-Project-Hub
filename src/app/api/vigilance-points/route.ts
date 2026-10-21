import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("vigilancePoint", body);
  if (!__g.ok) return __g.response;

  const point = await prisma.vigilancePoint.create({
    data: { initiativeId: body.initiativeId, description: body.description },
  });
  await logTimelineEvent(body.initiativeId, "vigilance", `Point de vigilance : « ${point.description} »`);
  return NextResponse.json(point, { status: 201 });
}
