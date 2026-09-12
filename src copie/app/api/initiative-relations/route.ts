import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
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
