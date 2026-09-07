import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const establishment = await prisma.establishment.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      type: body.type ?? undefined,
      localisation: body.localisation ?? undefined,
    },
  });
  return NextResponse.json(establishment);
}
