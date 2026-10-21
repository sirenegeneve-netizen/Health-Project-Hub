import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardInitiative } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardInitiative(String(body.initiativeSourceId), "modifier");
  if (!__g.ok) return __g.response;
  const __g2 = await guardInitiative(String(body.initiativeCibleId), "voir");
  if (!__g2.ok) return __g2.response;
  if (body.initiativeSourceId === body.initiativeCibleId) {
    return NextResponse.json({ error: "Une initiative ne peut pas être en relation avec elle-même." }, { status: 400 });
  }
  const relation = await prisma.initiativeRelation.create({
    data: {
      initiativeSourceId: body.initiativeSourceId,
      initiativeCibleId: body.initiativeCibleId,
      type: body.type,
      note: body.note || null,
      auto: false,
    },
  });
  return NextResponse.json(relation, { status: 201 });
}
