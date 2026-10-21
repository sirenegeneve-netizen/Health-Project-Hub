import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTemplateChoices } from "@/lib/templateEngine";
import { guardAuthenticated } from "@/lib/access";

// Modèles proposés à la création d'une initiative pour un type donné.
export async function GET(req: NextRequest) {
  const __g = await guardAuthenticated();
  if (!__g.ok) return __g.response;
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Paramètre type manquant." }, { status: 400 });
  return NextResponse.json(await getTemplateChoices(type));
}
