import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canEditInPlace } from "@/lib/templatePlan";

// Un modèle utilisé par des initiatives (ou déjà archivé) n'est jamais modifié sur place :
// l'API répond 409 et l'interface propose de créer une nouvelle version.
export async function loadEditableTemplate(templateId: string): Promise<{
  ok: boolean;
  template?: { id: string; name: string; status: string; familyId: string; typeKey: string };
  response?: NextResponse;
}> {
  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, status: true, familyId: true, typeKey: true },
  });
  if (!template) return { ok: false, response: NextResponse.json({ error: "Modèle introuvable." }, { status: 404 }) };
  const usage = await prisma.initiative.count({ where: { templateId } });
  if (!canEditInPlace(template, usage)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: usage > 0 ? "Ce modèle est utilisé par des initiatives : créez une nouvelle version pour le modifier." : "Ce modèle est archivé : créez une nouvelle version pour le modifier.", code: "template_locked" },
        { status: 409 }
      ),
    };
  }
  return { ok: true, template };
}
