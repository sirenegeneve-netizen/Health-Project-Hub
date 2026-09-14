import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const requirement = await prisma.requirement.create({
    data: {
      initiativeId: body.initiativeId,
      titre: body.titre,
      description: body.description || null,
      origine: body.origine || null,
      priorite: body.priorite || "normale",
    },
  });
  await logTimelineEvent(body.initiativeId, "besoin", `Besoin exprimé : « ${requirement.titre} »`);
  return NextResponse.json(requirement, { status: 201 });
}
