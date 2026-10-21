import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncIndicatorsToChildren } from "@/lib/diffusionDb";
import { isFrequence, isIndicatorStatut, isSens, toNumberOrNull } from "@/lib/objectifs";
import { isTheme } from "@/lib/referentiels";
import { ensureBaselineAction } from "@/lib/baselineDb";
import { guardRecord } from "@/lib/access";

// Ajoute un indicateur à un objectif. Sur un objectif de groupe diffusé, sa définition est aussitôt copiée
// dans chaque déclinaison d'établissement (valeurs propres à l'établissement).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: params.id }, include: { strategicGoal: { select: { libelle: true } } } });
  if (!cycle) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });

  const body = await req.json();
  const __g = await guardRecord("strategicGoalCycle", params.id, "modifier");
  if (!__g.ok) return __g.response;

  if (!String(body.nom || "").trim()) return NextResponse.json({ error: "Le nom de l'indicateur est requis." }, { status: 400 });
  if (body.sens !== undefined && !isSens(body.sens)) return NextResponse.json({ error: "Sens invalide." }, { status: 400 });
  if (body.frequence !== undefined && !isFrequence(body.frequence)) return NextResponse.json({ error: "Fréquence invalide." }, { status: 400 });
  if (body.statut !== undefined && !isIndicatorStatut(body.statut)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  if (body.theme !== undefined && body.theme !== null && body.theme !== "" && !isTheme(body.theme)) return NextResponse.json({ error: "Thème invalide." }, { status: 400 });
  const initiale = toNumberOrNull(body.valeurInitiale);
  const cible = toNumberOrNull(body.valeurCible);
  const actuelle = toNumberOrNull(body.valeurActuelle);
  if ([initiale, cible, actuelle].some((n) => Number.isNaN(n))) return NextResponse.json({ error: "Les valeurs doivent être des nombres." }, { status: 400 });

  const count = await prisma.goalIndicator.count({ where: { strategicGoalCycleId: cycle.id } });
  const actor = body.responsableActorId ? await prisma.actor.findUnique({ where: { id: body.responsableActorId }, select: { name: true } }) : null;
  const indicator = await prisma.goalIndicator.create({
    data: {
      strategicGoalCycleId: cycle.id,
      nom: String(body.nom).trim(),
      description: body.description ? String(body.description) : null,
      unite: body.unite ? String(body.unite) : null,
      sens: body.sens || "hausse",
      valeurInitiale: initiale,
      valeurCible: cible,
      frequence: body.frequence || "trimestrielle",
      echeance: body.echeance ? new Date(body.echeance) : null,
      responsableActorId: body.responsableActorId || null,
      responsable: actor?.name || (body.responsable ? String(body.responsable) : null),
      statut: body.statut || "actif",
      seuilAlerte: toNumberOrNull(body.seuilAlerte),
      principal: body.principal === true || count === 0,
      theme: body.theme || null,
    },
  });
  if (initiale !== null) {
    await prisma.goalIndicatorBaseline.create({
      data: { goalIndicatorId: indicator.id, valeur: initiale, dateMesure: body.baselineDate ? new Date(body.baselineDate) : new Date(), source: body.baselineSource ? String(body.baselineSource) : "saisie à la création", statut: "valide", auteur: user.name, validePar: user.name, valideLe: new Date() },
    });
  }
  // Valeur initiale inconnue : proposition d'état des lieux (action unique par objectif, réutilisée si elle existe).
  let baselineAction: { id: string; created: boolean } | null = null;
  if (initiale === null && body.proposeBaselineAction !== false) {
    baselineAction = await ensureBaselineAction({ cycleId: cycle.id, indicatorIds: [indicator.id], overrides: body.baselineAction });
  }
  if (actuelle !== null) {
    await prisma.goalIndicatorMeasure.create({ data: { goalIndicatorId: indicator.id, valeur: actuelle, dateMesure: new Date(), auteur: user.name, source: "création de l'indicateur" } });
  }
  if (!cycle.parentCycleId) await syncIndicatorsToChildren(cycle.id);

  await logAudit({ entityType: "objectif", entityId: cycle.id, entityLabel: cycle.strategicGoal.libelle.slice(0, 120), action: "update", changes: { indicateur_ajoute: { from: null, to: indicator.nom } }, user });
  return NextResponse.json({ ...indicator, baselineAction }, { status: 201 });
}
