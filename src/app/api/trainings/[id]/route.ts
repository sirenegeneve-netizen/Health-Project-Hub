import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const training = await prisma.trainingRecord.update({
    where: { id: params.id },
    data: {
      nbUsers: body.nbUsers !== undefined ? Number(body.nbUsers) : undefined,
      nbFormes: body.nbFormes !== undefined ? Number(body.nbFormes) : undefined,
      autonomyLevel: body.autonomyLevel !== undefined ? Number(body.autonomyLevel) : undefined,
    },
  });
  return NextResponse.json(training);
}
