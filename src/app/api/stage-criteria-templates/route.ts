import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectType = searchParams.get("projectType");
  const stageKey = searchParams.get("stageKey");
  if (!projectType || !stageKey) return NextResponse.json({ error: "paramètres manquants" }, { status: 400 });
  const templates = await prisma.stageCriterionTemplate.findMany({ where: { projectType, stageKey }, orderBy: { order: "asc" } });
  return NextResponse.json(templates);
}

// Crée un critère dans le modèle de checklist d'un type de projet (ou du
// modèle "defaut"). Le formulaire de Paramètres > Critères poste ici.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectType, stageKey, label } = body;
  if (!projectType || !stageKey || !label || !label.trim()) {
    return NextResponse.json({ error: "champs manquants" }, { status: 400 });
  }
  const count = await prisma.stageCriterionTemplate.count({ where: { projectType, stageKey } });
  const created = await prisma.stageCriterionTemplate.create({
    data: { projectType, stageKey, label: label.trim(), order: count },
  });
  return NextResponse.json(created, { status: 201 });
}
