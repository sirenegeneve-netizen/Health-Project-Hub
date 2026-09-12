import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const product = await prisma.installedProduct.create({
    data: {
      establishmentId: body.establishmentId,
      name: body.name,
      version: body.version || null,
      dateInstallation: body.dateInstallation ? new Date(body.dateInstallation) : null,
      status: body.status || "actif",
    },
  });
  return NextResponse.json(product, { status: 201 });
}
