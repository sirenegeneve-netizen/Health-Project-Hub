import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("requirement", body);
  if (!__g.ok) return __g.response;

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
