import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

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
