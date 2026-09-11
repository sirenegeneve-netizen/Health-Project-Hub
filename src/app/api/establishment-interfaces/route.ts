import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const iface = await prisma.establishmentInterface.create({
    data: {
      establishmentId: body.establishmentId,
      type: body.type,
      editeurTiers: body.editeurTiers || null,
      status: body.status || "active",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(iface, { status: 201 });
}
